---
id: "629af494-bc49-417d-bf54-6f0f6c4d1cf4"
type: "scenario"
label: "An adapter run as a repository sensor"
given: "a fitness function whose measure names studio-scale, a sensor of .radical/sensors/sensors.json naming the json adapter and its arguments, and another fitness function whose measure line carries an adapter's arguments"
then: "the adapter runs with the sensor's arguments for each constrained element, labelled with it; check warns about the measure line with arguments"
when: "radical sense run and radical check run"
---
