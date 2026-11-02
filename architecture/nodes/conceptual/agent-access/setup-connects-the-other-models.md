---
id: "225a793b-7c64-4d9b-8aa2-400fe597aa26"
type: "scenario"
label: "Setup connects the other models"
given: "a repository standards with version tags v1.0.0 and v1.1.0, and an empty folder for the model of payments"
metrics: |
  test(apps/cli/src/setup.test.ts › radical setup › asks for the models this one depends on, offers the newest tag, and fetches them) passed
  test(apps/cli/src/setup.test.ts › radical setup › adds the dependencies --depends-on names without asking) passed
then: "setup offers v1.1.0, writes deps.json with standards at v1.1.0 and fetches it into .radical/federation.json; the second run adds the other model without asking and keeps standards"
when: "radical setup runs in a terminal and the user names standards and its repository and takes the version offered; then again with --yes and --depends-on for a second model"
---
