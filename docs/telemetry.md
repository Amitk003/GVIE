# Telemetry

AI must return numbers in a fixed shape. Free text is never saved.

## Call

POST to `https://api.cloudinary.com/v2/analysis/ CLOUD_NAME /analyze/ai_vision_tagging` with source uri, a clear prompt, and a json_schema.

## Water schema fields

* infrastructure_category: Water Access, Solar Array, Reforestation, Educational Facility, Agricultural Plot
* operational_status: Fully Operational, Under Construction, Damaged, Inoperable
* quantitative_unit_count: integer zero or more
* hazard_present: true or false
* confidence_rating: 0 to 1

Forest and solar schemas use the same idea with canopy, count, soil, and tilt fields.

## Checks

* Must have all required fields and no extra fields
* Numbers must be in range
* If fail, retry once with low temp, then send to human review
* Low confidence under 0.6 never becomes Verified
