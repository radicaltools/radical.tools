---
id: "3955cbd0-4201-4fe2-a3cd-5b0032d3762e"
type: "scenario"
label: "Scripts verified"
given: "a prepared round whose run 5 has a script that fails and one that passes, and scripts that say REPRODUCED: yes or no, one of them exiting 0 while it says yes, and scripts that print a BUG or FINDING line"
then: "the server answered on the run's port while they ran and is stopped after, each script's output and exit status is shown with whether it shows the bug, the script whose line and exit disagree is named so, the scripts that show the bug are listed, and the journal keeps them; a BUG or FINDING line says the bug shows, whatever else the script prints"
when: "radical explore verify 5 runs both"
---
