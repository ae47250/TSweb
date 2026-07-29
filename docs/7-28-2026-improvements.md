# Where the estimate app stands, and what I'd fix first

## Bottom line up front

The AI isn't dumb, and a bigger model won't fix this. The real problem is that the app decides things too early and never writes down why.

Say a customer's notes mention two trees, then later say "actually just the one." Right now the system just picks an answer somewhere in the pipeline and moves on. Nobody, not even us, can point to why it landed there. That's the core issue. Everything below is a symptom of it.

## The five things I'd fix, in order of impact

| # | What | Why it matters | How much work |
|---|------|-----------------|----------------|
| 1 | Stop throwing away the "runner-up" answers | So we can see when the notes were actually confusing, instead of the system quietly guessing | Large |
| 2 | Put all the "which answer wins" logic in one place | So we can explain, test, and fix that logic instead of hunting through five different spots in the code | Medium |
| 3 | Build a test set that grades accuracy, not just "did it crash" | So we know a change actually made the app smarter, instead of guessing | Medium |
| 4 | Save what your reviewers correct, and why | Turns every human fix into something we can learn from, not a one-time patch | Medium |
| 5 | Keep "what we know" separate from "how we word it for the customer" | So a nicely-written sentence never gets mistaken for a verified fact | Medium |

## 1. Stop collapsing everything into one answer too soon

Today, when notes contain two candidate values for something, two prices, two tree counts, two phone numbers, the app resolves that down to a single value very early, before anyone gets a chance to look at it. It happens in several spots: taking whichever value shows up first, ranking phone numbers and keeping the top one, merging prices into one figure.

That's fine when notes are clean. It falls apart on the messy cases we actually care about: corrections, contradictions, "which of these two prices is which."

**The fix:** have the system hold onto every candidate value it finds, along with the exact quote it came from, until a dedicated step decides which one wins. Nothing gets silently discarded before a human, or a clear rule, has weighed in.

Take this example:

> "Remove two oaks by the garage. Actually, only remove the rear oak. Quote $1,800 without the stump or $2,200 with it."

The system should hang onto all four pieces of information, flag that the two tree-count mentions look like a correction, and note that the two prices probably aren't a conflict at all, they're likely two different options. Keeping the raw candidates around is what lets us make that call later instead of guessing now.

**Practical first step:** we don't need to rebuild everything at once. I'd start with four fields, phone number, job address, tree count, and price, since between them they cover the main flavors of "messy" we run into.

## 2. Put "which answer wins" in one clearly labeled place

Ask "why did the system pick this value?" right now and the honest answer is "depends which of five or six code paths happened to touch that field." There's no single place you could point a new engineer to and say, this is how we decide.

**The fix:** build one dedicated step whose only job is deciding the winner among candidate values, and have it explain its reasoning in plain terms, not a vague confidence score like "84% sure." Something more like:

- "Only one clear value was given, we used it."
- "The customer corrected themselves later, we used the correction."
- "Two firm, different values were given with no indication one replaces the other, this needs a human to look at it."
- "Nothing was said about this, we're leaving it blank rather than guessing."

That last one matters more than it sounds. A system willing to say "I don't know" on the hard cases is more trustworthy than one that always produces a confident-looking answer, even when it's wrong.

## 3. Build a test set that actually measures accuracy

The app has decent tests for "does the workflow run without crashing." It has very few for "did we get the facts right." Those are different questions, and right now we can only answer the first one.

One data point: in a recent review, the messy-input test cases went from 24 failures to 48 while the overall test suite kept passing. That's the gap in a nutshell. The app looked healthy by the metrics we were tracking while it got worse at the thing that actually matters to your customers.

**The fix:** put together roughly 60 real (anonymized) examples, mark up by hand what the correct answer should be for each, and hold back a third as a "final exam" set we don't peek at while developing. Every time we change the prompt, the model, or the logic, we run it against this set and get an actual score, not a gut feeling.

## 4. Save what your reviewers correct, and treat it as data

Right now, when your estimator corrects something the app got wrong, that correction just overwrites the old value. We lose the "before," we lose why it was wrong, and we lose any way to spot patterns like "we keep messing up phone numbers" or "the app keeps missing corrections."

**The fix:** log every correction as its own event, what the app proposed, what the reviewer changed it to, and eventually why. That turns your team's day-to-day corrections into a running record of exactly where the app is weak, which is about the best source of "what to fix next" we could ask for.

One nuance worth flagging: not every correction means the app made a mistake. If your estimator adds stump grinding during review because the customer asked for it on the phone, that's a business decision, not an extraction error. We'd want to log those separately so we don't end up "fixing" something that was never broken.

## 5. Keep the facts separate from the customer-facing wording

The app currently generates some of the polished customer-facing summary text in the same step that's supposed to be extracting facts, and in at least one case that generated wording ends up sitting in a field meant to hold evidence. That blurs "what the customer actually said" with "how we chose to phrase it back to them."

**The fix:** keep three things clearly separate: the verified facts, any business decisions your team made on top of those facts, and the final written summary, which should always trace back to specific facts or decisions. A generated sentence should never count as its own proof of anything.

## Suggested order of operations

The impact ranking above isn't quite the safest build order. Here's how I'd sequence it instead:

1. **Start measuring first.** Build the 40 to 60 example test set and get a baseline before changing anything. Also stop treating generated summary text as evidence, that's a quick, low-risk fix.
2. **Add the "keep all candidates" layer for just four fields**, running alongside the current system so nothing breaks.
3. **Add the single decision-making step** for those same four fields, and surface it in the review screen so your team can see the reasoning.
4. **Start logging reviewer corrections** as structured events.
5. **Move the customer-facing writing step** to run only after facts are locked in and approved.

## What I would *not* spend money on right now

- A bigger or more expensive model
- Fine-tuning a custom model
- Adding a vector database / "search your documents" setup
- More prompt examples
- A confidence percentage on each answer
- A full rewrite of the existing logic
- Prettier customer-facing wording
- A visual redesign
- Auto-learning from every reviewer edit without a review step first

None of it fixes the actual issue. A more expensive model would still quietly pick a winner, throw away the runner-up, and leave us with no way to check its work. Get the app to show its work first. Optimize after.