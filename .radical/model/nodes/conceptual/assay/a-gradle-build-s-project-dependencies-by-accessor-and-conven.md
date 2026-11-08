---
id: "f9d5031a-e154-472b-8485-5885dbae0cd7"
type: "scenario"
label: "A Gradle build's project dependencies by accessor and convention plugin"
given: "an Android build with type-safe project accessors whose feature module applies a convention plugin that adds a dependency on core:ui in its code"
then: "the app depends on the feature module and, for its tests, on core:data-test, and the feature module depends on core:ui"
when: "Assay reads it"
---
