# MIGRATION FEASIBILITY — ADO-0001  (self-test BAD companion)
# Spine check: F-01 exists in the inventory (valid ref); F-99 does not (dangling → hard fail).

| Feature | Rating | Notes |
|F-01 | GREEN | quantity validation ports cleanly |
| F-99 | RED | references a feature-ID that was never defined in the inventory — the spine is broken |
