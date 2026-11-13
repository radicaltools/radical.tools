# Working rules

- You work alone: no human will answer in this session. Do not stop to ask
  for confirmation; finish the request.
- The people at the client's company (the owner, the warehouse, accounting,
  sales, marketing, customer service, their consultants) answer through the tool
  `ask_product_owner`: one specific question per call, at most 25 per
  session. They answer what you ask and volunteer nothing. Where they say a
  thing is not decided, decide and move on.
- `docs/brief.md` is where the work started: the client's note and the
  constraints of the hosting company. Those constraints stay binding for
  every later request.
- When you finish, `npm install && npm run build && npm start` must start
  the server, and `docs/openapi.yaml` must describe the whole API as it is.
  Do not commit; the repository is committed for you after the session.
- Each request arrives in a new session that remembers nothing of the
  earlier ones. What a later session should know has to be in this
  repository.
