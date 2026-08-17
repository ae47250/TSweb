#!/usr/bin/env node

import { customerPipelinePolicy } from "../lib/customerPipeline.js";

const enabledEnv = {
  TSWEB_DEPLOYMENT_STAGE: "production",
  CUSTOMER_DELIVERY_ENABLED: "true",
  CUSTOMER_RESOLUTION_ROLLOUT: "full",
  CUSTOMER_RESOLUTION_RELEASE_APPROVED: "true",
  CUSTOMER_ASSEMBLER_ROLLOUT: "off",
  CUSTOMER_ASSEMBLER_RELEASE_APPROVED: "false",
  ENABLE_CANONICAL_SERVICE_ASSEMBLER: "false",
  ENABLE_FINAL_OPTION_STRUCTURE_ENFORCEMENT: "false",
  ENABLE_READINESS_SAFETY_BLOCKING: "true",
};
const enabled = customerPipelinePolicy({ documentId: "rollback-verification", env: enabledEnv });
const rolledBack = customerPipelinePolicy({
  documentId: "rollback-verification",
  env: { ...enabledEnv, CUSTOMER_RESOLUTION_ROLLOUT: "off" },
});

const failures = [];
if (enabled.active_pipeline !== "resolution" || enabled.delivery_blocked) {
  failures.push("the enabled production policy did not select an approved resolution pipeline");
}
if (rolledBack.active_pipeline !== "legacy") failures.push("rollback did not disable customer-facing resolution");
if (!rolledBack.delivery_blocked) failures.push("production rollback did not fail closed against legacy delivery");
if (enabled.assembler.customer_facing_enabled) failures.push("baseline rollback fixture unexpectedly enabled the assembler");
if (rolledBack.assembler.customer_facing_enabled) failures.push("resolution rollback unexpectedly enabled the assembler");
if (rolledBack.assembler.prerequisites_met) failures.push("resolution rollback unexpectedly left assembler prerequisites enabled");

console.log(`Customer pipeline rollback verification: ${failures.length ? "FAIL" : "PASS"}`);
console.log("  Rollback action: CUSTOMER_RESOLUTION_ROLLOUT=off");
console.log("  Expected result: active pipeline legacy, customer delivery blocked");
console.log("  Assembler state: rollout off, builder flags false");
for (const failure of failures) console.error(`  FAIL: ${failure}`);
if (failures.length) process.exitCode = 1;
