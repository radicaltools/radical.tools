---
id: "4d6fafbb-01f9-49e3-8f81-ba3226fa4f6c"
type: "scenario"
label: "ASP.NET Core routes from class and action templates"
given: "an ASP.NET Core controller with [Route(\"/api/[controller]\")] and another attribute between it and the class, whose actions carry [HttpPost] with [Route(\"{date}/jobs\")], [HttpGet(\"{id}\")], [HttpGet(\"/health\")] and [Route(\"[action]\")] with [HttpGet]"
then: "its routes are POST /api/workshopplanning/{date}/jobs, GET /api/workshopplanning/{id}, GET /health and GET /api/workshopplanning/refresh, each on its action's line"
when: "Assay reads it"
---
