---
id: "d6e2d195-7e07-4a76-b1b4-e9bd46f1d8d1"
type: "scenario"
label: "A database that runs code"
given: "a model on the C4 metamodel and one on the Radical metamodel, each with a system holding a database, a container and a queue, another system and a person"
then: "each is allowed but the relation from the database to the person, which is refused; the Components viewpoint draws the database with its components, and the live layout keeps them inside it"
when: "a component is placed in the database, the database is related to the other system, the container, the queue and the component, the person to the database and the database to the person; in the Radical model the database realises an entity, implements a state machine and performs a step"
---
