---
id: "c32eac71-fa0f-499c-8240-6c834b1b0c2a"
type: "scenario"
label: "MVC routes by convention"
given: "an ASP.NET Core MVC controller with no [Route] and no [ApiController], whose public actions are Index with [HttpGet], Details with no attribute and RegisterAsync with [HttpPost], beside a constructor, a private method and a public method returning no action result"
then: "its routes are GET /customermanagement, ALL /customermanagement/details and POST /customermanagement/register, and nothing else"
when: "Assay reads it"
---
