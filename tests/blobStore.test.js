import test from "node:test";
import assert from "node:assert/strict";
import {
  acceptedPdfPath,
  estimateIndexPath,
  estimatePath,
  manualAcceptancePath,
  signedPdfPath,
  signedResultPath,
} from "../lib/blobStore.js";

test("Alpha Tree Blob paths use the TSwebAppBlob prefix plan", () => {
  const estimateId = "EST-TEST-001";
  assert.equal(estimateIndexPath(), "alphatree/estimates/index.json");
  assert.equal(estimatePath(estimateId), "alphatree/estimates/EST-TEST-001/estimate.json");
  assert.equal(signedResultPath(estimateId), "alphatree/estimates/EST-TEST-001/signed-result.json");
  assert.equal(signedPdfPath(estimateId), "alphatree/estimates/EST-TEST-001/signed-estimate.pdf");
  assert.equal(manualAcceptancePath(estimateId), "alphatree/estimates/EST-TEST-001/manual-acceptance.json");
  assert.equal(acceptedPdfPath(estimateId), "alphatree/estimates/EST-TEST-001/accepted-estimate.pdf");
});

test("Blob paths stay Alpha Tree only", () => {
  const paths = [
    estimateIndexPath(),
    estimatePath("EST-TEST-001"),
    signedResultPath("EST-TEST-001"),
    manualAcceptancePath("EST-TEST-001"),
    signedPdfPath("EST-TEST-001"),
    acceptedPdfPath("EST-TEST-001"),
  ];
  for (const path of paths) {
    assert.match(path, /^alphatree\//);
    assert.doesNotMatch(path, /beta|tenant|company/i);
    assert.doesNotMatch(path, /^https?:\/\//);
  }
});
