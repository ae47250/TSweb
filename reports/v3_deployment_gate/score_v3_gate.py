#!/usr/bin/env python3
import argparse, json, re
from collections import defaultdict

def load_jsonl(path):
    out = {}
    with open(path, encoding="utf-8") as f:
        for line_no, line in enumerate(f, 1):
            if not line.strip():
                continue
            row = json.loads(line)
            cid = row.get("case_id")
            if not cid:
                raise ValueError(f"{path}:{line_no}: missing case_id")
            out[cid] = row
    return out

def norm_text(v):
    if v is None:
        return ""
    return " ".join(re.findall(r"[a-z0-9]+", str(v).lower()))

def norm_phone(v):
    return re.sub(r"\D", "", str(v or ""))

def norm_email(v):
    return str(v or "").strip().lower()

def norm_price(v):
    if v is None or v == "":
        return None
    digits = re.sub(r"[^\d]", "", str(v))
    return int(digits) if digits else None

def token_f1(pred, gold):
    p = norm_text(pred).split()
    g = norm_text(gold).split()
    if not p and not g:
        return 1.0
    if not p or not g:
        return 0.0
    pc, gc = {}, {}
    for x in p: pc[x] = pc.get(x, 0) + 1
    for x in g: gc[x] = gc.get(x, 0) + 1
    overlap = sum(min(pc.get(x, 0), gc.get(x, 0)) for x in set(pc) | set(gc))
    precision = overlap / len(p)
    recall = overlap / len(g)
    return 0.0 if precision + recall == 0 else 2 * precision * recall / (precision + recall)

def service_f1(pred, gold):
    pred = pred or []
    gold = gold or []
    ps = {norm_text(x) for x in pred if norm_text(x)}
    gs = {norm_text(x) for x in gold if norm_text(x)}
    if not ps and not gs: return 1.0
    if not ps or not gs: return 0.0
    overlap = len(ps & gs)
    p, r = overlap / len(ps), overlap / len(gs)
    return 2*p*r/(p+r) if p+r else 0.0

def score_one(pred, gold):
    e = gold["expected"]
    exact = {
        "customer_name": norm_text(pred.get("customer_name")) == norm_text(e["customer_name"]),
        "phone": norm_phone(pred.get("phone")) == norm_phone(e["phone"]),
        "email": norm_email(pred.get("email")) == norm_email(e["email"]),
        "option_a_price": norm_price(pred.get("option_a_price")) == e["option_a_price"],
        "option_b_price": norm_price(pred.get("option_b_price")) == e["option_b_price"],
    }
    a_f1 = token_f1(pred.get("option_a_description"), e["option_a_description"])
    b_f1 = token_f1(pred.get("option_b_description"), e["option_b_description"])
    svc_f1 = service_f1(pred.get("option_b_additional_services"), e["option_b_additional_services"])
    option_pair_exact = exact["option_a_price"] and exact["option_b_price"]
    critical_exact = exact["email"] and exact["phone"] and option_pair_exact
    return exact, a_f1, b_f1, svc_f1, option_pair_exact, critical_exact

def summarize(preds, golds, label):
    rows = []
    missing = []
    for cid, gold in golds.items():
        pred = preds.get(cid)
        if pred is None:
            missing.append(cid)
            pred = {"case_id": cid}
        rows.append((cid, gold, *score_one(pred, gold)))

    def pct(vals): return 100 * sum(vals) / len(vals) if vals else 0
    print(f"\n=== {label} ===")
    print(f"Rows scored: {len(rows)} | Missing predictions: {len(missing)}")
    fields = ["customer_name","phone","email","option_a_price","option_b_price"]
    for field in fields:
        print(f"{field:28s} {pct([r[2][field] for r in rows]):6.1f}%")
    print(f"{'option price pair exact':28s} {pct([r[6] for r in rows]):6.1f}%")
    print(f"{'critical row exact':28s} {pct([r[7] for r in rows]):6.1f}%")
    print(f"{'option A description F1':28s} {sum(r[3] for r in rows)/len(rows):6.3f}")
    print(f"{'option B description F1':28s} {sum(r[4] for r in rows)/len(rows):6.3f}")
    print(f"{'Option B services F1':28s} {sum(r[5] for r in rows)/len(rows):6.3f}")

    for bucket in ("easy","medium","hard"):
        br = [r for r in rows if r[1]["bucket"] == bucket]
        print(f"\n{bucket.upper()}:")
        print(f"  price-pair exact: {pct([r[6] for r in br]):.1f}%")
        print(f"  critical exact:   {pct([r[7] for r in br]):.1f}%")
        print(f"  desc mean F1:     {(sum((r[3]+r[4])/2 for r in br)/len(br)):.3f}")

    failures = []
    for cid, gold, exact, af1, bf1, sf1, pair, critical in rows:
        if not pair or af1 < .8 or bf1 < .8:
            failures.append({
                "case_id": cid,
                "bucket": gold["bucket"],
                "boundary": gold["metadata"]["option_boundary_style"],
                "price_pair_exact": pair,
                "option_a_desc_f1": round(af1, 3),
                "option_b_desc_f1": round(bf1, 3),
            })
    print("\nMaterial option failures:")
    for row in failures:
        print(json.dumps(row))
    return rows

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--answer-key", required=True)
    ap.add_argument("--deployed", required=True)
    ap.add_argument("--staged", required=True)
    args = ap.parse_args()

    gold = load_jsonl(args.answer_key)
    dep = load_jsonl(args.deployed)
    stg = load_jsonl(args.staged)
    dep_rows = summarize(dep, gold, "CURRENT DEPLOYED")
    stg_rows = summarize(stg, gold, "STAGED / VERSION 3.0")

    # Deployment gate:
    # - staged must not regress on any critical exact field overall
    # - staged hard price-pair exact >= 90%
    # - staged overall price-pair exact >= 97%
    # - staged mean description F1 >= 0.90
    def metrics(rows):
        n=len(rows)
        pair=sum(r[6] for r in rows)/n
        hard=[r for r in rows if r[1]["bucket"]=="hard"]
        hard_pair=sum(r[6] for r in hard)/len(hard)
        desc=sum((r[3]+r[4])/2 for r in rows)/n
        field={k:sum(r[2][k] for r in rows)/n for k in ["phone","email","option_a_price","option_b_price"]}
        return {"pair":pair,"hard_pair":hard_pair,"desc":desc,"field":field}
    dm, sm = metrics(dep_rows), metrics(stg_rows)
    no_regression = all(sm["field"][k] >= dm["field"][k] for k in sm["field"])
    pass_gate = no_regression and sm["pair"] >= .97 and sm["hard_pair"] >= .90 and sm["desc"] >= .90
    print("\n=== VERSION 3.0 DEPLOYMENT DECISION ===")
    print("PASS — deploy Version 3.0" if pass_gate else "HOLD — do not deploy Version 3.0 yet")
    print(json.dumps({"deployed":dm, "staged":sm, "no_critical_regression":no_regression}, indent=2))

if __name__ == "__main__":
    main()
