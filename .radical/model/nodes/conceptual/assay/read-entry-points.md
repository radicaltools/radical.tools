---
id: "10dd6e39-0a30-458a-964e-2bd422518401"
type: "requirement"
label: "Read entry points"
action: "the system shall record each entry point as a fact of that unit with its kind, its name, the method and route or the caption (a route's path joins its class's base, Spring's @RequestMapping or ASP.NET Core's [Route] with [controller] and [action] filled in, with its method's template, an absolute one alone, under the unit's servlet context path; an MVC controller with neither [Route] nor [ApiController] routes each public action by convention at /{controller}/{action}, Index at /{controller}; a Feign client's methods are calls of another service, not routes; a Go route of net/http or gorilla/mux (Handle, HandleFunc, Go 1.22's \"GET /x\") is under the prefixes of the subrouters it hangs off (X = Y.PathPrefix(\"/p\").Subrouter(), in any file of its unit) with its .Methods(…); a Django route is each path() and re_path() of a urls.py, its regular expression's groups as {name}, an include() none; a route in a comment is none), and its file and line, and the unit's test framework (a package of an npm workspace takes its root's)"
ears_type: "event-driven"
rationale: "A process starts where a user or a clock enters the code; a legacy desktop application's forms and menus are its screens."
trigger: "a unit's code declares an HTTP route (Express, Spring, ASP.NET Core, Flask, FastAPI, Go), a VB6 form or menu, a scheduled job or a message handler, or its manifest names a test framework"
---
