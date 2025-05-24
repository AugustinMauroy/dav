import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	icalToString,
	icalToWebDav,
	parseIcal,
	webDavToIcal,
	webDavToString,
	parseWebDav,
	parseIcalDateTime,
	formatToIcalDateTime,
	mapIcalObjectToEvent,
	mapEventToIcalObject,
} from "./ical.ts";
import type { Event } from "./types.ts";

const singleEventIcal = [
	"BEGIN:VEVENT",
	"SUMMARY:Test Event",
	"DTSTART:20230101T100000Z",
	"DTEND:20230101T110000Z",
	"UID:event1@example.com",
	"DESCRIPTION:This is a test event with a colon: in the description.",
	"END:VEVENT",
].join("\n");

const singleEventObject = {
	SUMMARY: "Test Event",
	DTSTART: "20230101T100000Z",
	DTEND: "20230101T110000Z",
	UID: "event1@example.com",
	DESCRIPTION: "This is a test event with a colon: in the description.",
};

const multipleEventsIcal = [
	"BEGIN:VEVENT",
	"SUMMARY:Event 1",
	"UID:event1@example.com",
	"END:VEVENT",
	"BEGIN:VEVENT",
	"SUMMARY:Event 2",
	"UID:event2@example.com",
	"END:VEVENT",
].join("\n");

const multipleEventsObjects = [
	{ SUMMARY: "Event 1", UID: "event1@example.com" },
	{ SUMMARY: "Event 2", UID: "event2@example.com" },
];

// Expected output for icalToWebDav / webDavToIcal based on their current implementation
// which strips END:VEVENT and joins multiple events' content with a single newline.
const singleEventStrippedIcalFormat = [
	"BEGIN:VEVENT",
	"SUMMARY:Test Event",
	"DTSTART:20230101T100000Z",
	"DTEND:20230101T110000Z",
	"UID:event1@example.com",
	"DESCRIPTION:This is a test event with a colon: in the description.",
].join("\n");

const multipleEventsStrippedIcalFormat = [
	"BEGIN:VEVENT",
	"SUMMARY:Event 1",
	"UID:event1@example.com",
	"BEGIN:VEVENT", // Joined by a single \n after the content of the first event
	"SUMMARY:Event 2",
	"UID:event2@example.com",
].join("\n");

describe("ical tests", () => {
	describe("parseIcal", () => {
		it("should parse a single VEVENT", () => {
			const icalData = singleEventIcal;
			const expected = [singleEventObject];

			assert.deepStrictEqual(parseIcal(icalData), expected);
		});

		it("should parse multiple VEVENTs", () => {
			const icalData = multipleEventsIcal;
			const expected = multipleEventsObjects;

			assert.deepStrictEqual(parseIcal(icalData), expected);
		});

		it("should return an empty array for empty input", () => {
			assert.deepStrictEqual(parseIcal(""), []);
		});

		it("should return an empty array for input with no VEVENTs", () => {
			const icalData = "BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR";

			assert.deepStrictEqual(parseIcal(icalData), []);
		});

		it("should handle properties with colons in values", () => {
			const icalDataWithColon = [
				"BEGIN:VEVENT",
				"SUMMARY:Event with : colon",
				"DESCRIPTION:Value: with multiple: colons",
				"END:VEVENT",
			].join("\n");
			const expected = [
				{
					SUMMARY: "Event with : colon",
					DESCRIPTION: "Value: with multiple: colons",
				},
			];

			assert.deepStrictEqual(parseIcal(icalDataWithColon), expected);
		});

		it("should ignore lines outside VEVENT blocks", () => {
			const icalData = [
				"BEGIN:VCALENDAR",
				"PROP:VCALPROP",
				singleEventIcal,
				"END:VCALENDAR",
			].join("\n");

			assert.deepStrictEqual(parseIcal(icalData), [singleEventObject]);
		});

		it("should handle VEVENT with no properties", () => {
			const icalData = "BEGIN:VEVENT\nEND:VEVENT";

			assert.deepStrictEqual(parseIcal(icalData), [{}]);
		});

		it("should skip lines that are not valid key-value pairs", () => {
			const icalData = [
				"BEGIN:VEVENT",
				"SUMMARY:Valid Event",
				"MALFORMEDLINE",
				"KEYONLY:",
				":VALUEONLY",
				"END:VEVENT",
			].join("\n");
			const expected = [{ SUMMARY: "Valid Event" }];

			assert.deepStrictEqual(parseIcal(icalData), expected);
		});
	});

	describe("icalToString", () => {
		it("should convert a single event object to iCalendar string", () => {
			const events = [singleEventObject];

			const result = icalToString(events);

			assert.deepStrictEqual(parseIcal(result), events);
			assert.ok(result.startsWith("BEGIN:VEVENT"));
			assert.ok(result.includes("\nSUMMARY:Test Event\n"));
			assert.ok(
				result.includes(
					"\nDESCRIPTION:This is a test event with a colon: in the description.\n",
				),
			);
			assert.ok(result.endsWith("\nEND:VEVENT"));
		});

		it("should convert multiple event objects to iCalendar string", () => {
			const events = multipleEventsObjects;

			const result = icalToString(events);

			assert.deepStrictEqual(parseIcal(result), events);
			assert.strictEqual(result.match(/BEGIN:VEVENT/g)?.length, 2);
			assert.strictEqual(result.match(/END:VEVENT/g)?.length, 2);
			assert.ok(result.includes("SUMMARY:Event 1"));
			assert.ok(result.includes("SUMMARY:Event 2"));
		});

		it("should return an empty string for an empty array of events", () => {
			assert.strictEqual(icalToString([]), "");
		});

		it("should handle event with no properties", () => {
			const events = [{}];

			const expected = "BEGIN:VEVENT\nEND:VEVENT";

			assert.strictEqual(icalToString(events), expected);
		});
	});

	describe("icalToWebDav", () => {
		const baseUrl = "http://example.com/caldav/";

		it("should extract a single VEVENT, stripping END:VEVENT", () => {
			const icalData = singleEventIcal;
			const expected = singleEventStrippedIcalFormat;
			assert.strictEqual(icalToWebDav(icalData, baseUrl), expected);
		});

		it("should extract multiple VEVENTs, stripping END:VEVENTs and joining their content", () => {
			const icalData = multipleEventsIcal;
			const expected = multipleEventsStrippedIcalFormat;
			assert.strictEqual(icalToWebDav(icalData, baseUrl), expected);
		});

		it("should return an empty string for empty ical data", () => {
			assert.strictEqual(icalToWebDav("", baseUrl), "");
		});

		it("should return an empty string if no VEVENTs are present", () => {
			const icalData = "BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR";
			assert.strictEqual(icalToWebDav(icalData, baseUrl), "");
		});

		it("should only process VEVENT blocks from a full ical string, stripping END:VEVENT", () => {
			const fullIcalData = [
				"BEGIN:VCALENDAR",
				"VERSION:2.0",
				singleEventIcal,
				"SOME:OTHER:STUFF",
				"END:VCALENDAR",
			].join("\n");
			assert.strictEqual(
				icalToWebDav(fullIcalData, baseUrl),
				singleEventStrippedIcalFormat,
			);
		});

		it("should handle VEVENT that is not properly ended (ends with EOF)", () => {
			const icalData = "BEGIN:VEVENT\nSUMMARY:Incomplete";
			const expected = "BEGIN:VEVENT\nSUMMARY:Incomplete";
			assert.strictEqual(icalToWebDav(icalData, baseUrl), expected);
		});

		it("should handle malformed VEVENT (e.g., BEGIN:VEVENT followed by another BEGIN:VEVENT)", () => {
			const icalData =
				"BEGIN:VEVENT\nSUMMARY:Outer Event\nBEGIN:VEVENT\nSUMMARY:Inner Event\nEND:VEVENT";
			// Expected behavior:
			// Outer event (incomplete) is pushed when inner BEGIN:VEVENT is found.
			// Inner event (complete but without its END:VEVENT) is pushed.
			const expected =
				"BEGIN:VEVENT\nSUMMARY:Outer Event\nBEGIN:VEVENT\nSUMMARY:Inner Event";
			assert.strictEqual(icalToWebDav(icalData, baseUrl), expected);
		});
	});

	describe("webDavToIcal", () => {
		it("should process a single VEVENT string, stripping END:VEVENT", () => {
			const webDavData = singleEventIcal; // Using ical string as input due to function's nature
			const expected = singleEventStrippedIcalFormat;

			assert.strictEqual(webDavToIcal(webDavData), expected);
		});

		it("should process multiple VEVENT strings, stripping END:VEVENTs and joining their content", () => {
			const webDavData = multipleEventsIcal;
			const expected = multipleEventsStrippedIcalFormat;

			assert.strictEqual(webDavToIcal(webDavData), expected);
		});

		it("should return an empty string for empty WebDAV data", () => {
			assert.strictEqual(webDavToIcal(""), "");
		});

		it("should return an empty string if no VEVENTs are present in WebDAV data", () => {
			const webDavData = "SOME:OTHERDATA\nKEY:VALUE"; // No VEVENTs

			assert.strictEqual(webDavToIcal(webDavData), "");
		});

		it("should only process VEVENT blocks from a mixed string, stripping END:VEVENT", () => {
			const mixedData = [
				"NON-ICAL-HEADER",
				singleEventIcal,
				"NON-ICAL-FOOTER",
			].join("\n");

			assert.strictEqual(
				webDavToIcal(mixedData),
				singleEventStrippedIcalFormat,
			);
		});

		it("should handle malformed VEVENT (e.g., BEGIN:VEVENT followed by another BEGIN:VEVENT)", () => {
			const webDavData =
				"BEGIN:VEVENT\nSUMMARY:Outer Event\nBEGIN:VEVENT\nSUMMARY:Inner Event\nEND:VEVENT";
			// Expected behavior:
			// Outer event (incomplete) is pushed when inner BEGIN:VEVENT is found.
			// Inner event (complete but without its END:VEVENT) is pushed.
			const expected =
				"BEGIN:VEVENT\nSUMMARY:Outer Event\nBEGIN:VEVENT\nSUMMARY:Inner Event";
			assert.strictEqual(webDavToIcal(webDavData), expected);
		});
	});

	describe("parseWebDav", () => {
		// This function is currently identical to parseIcal in implementation
		it("should parse a single VEVENT from WebDAV string (assuming VEVENT format)", () => {
			const webDavData = singleEventIcal; // Using ical string as input
			const expected = [singleEventObject];

			assert.deepStrictEqual(parseWebDav(webDavData), expected);
		});

		it("should parse multiple VEVENTs from WebDAV string", () => {
			const webDavData = multipleEventsIcal;
			const expected = multipleEventsObjects;

			assert.deepStrictEqual(parseWebDav(webDavData), expected);
		});

		it("should return an empty array for empty WebDAV input", () => {
			assert.deepStrictEqual(parseWebDav(""), []);
		});

		it("should return an empty array for WebDAV input with no VEVENTs", () => {
			const webDavData =
				"<d:multistatus xmlns:d='DAV:'><d:response/></d:multistatus>"; // Example non-VEVENT data

			assert.deepStrictEqual(parseWebDav(webDavData), []);
		});
	});

	describe("webDavToString", () => {
		// This function is currently identical to icalToString in implementation
		it("should convert a single event object to WebDAV (VEVENT) string", () => {
			const events = [singleEventObject];

			const result = webDavToString(events);

			assert.deepStrictEqual(parseIcal(result), events); // Use parseIcal for verification
			assert.ok(result.startsWith("BEGIN:VEVENT"));
			assert.ok(result.includes("\nSUMMARY:Test Event\n"));
			assert.ok(result.endsWith("\nEND:VEVENT"));
		});

		it("should convert multiple event objects to WebDAV (VEVENT) string", () => {
			const events = multipleEventsObjects;
			const result = webDavToString(events);

			assert.deepStrictEqual(parseIcal(result), events); // Use parseIcal for verification
			assert.strictEqual(result.match(/BEGIN:VEVENT/g)?.length, 2);
			assert.strictEqual(result.match(/END:VEVENT/g)?.length, 2);
		});

		it("should return an empty string for an empty array of events (WebDAV)", () => {
			assert.strictEqual(webDavToString([]), "");
		});
	});

	describe("parseIcalDateTime", () => {
		it("should parse a valid iCalendar date-time string to Date object", () => {
			const icalDateTime = "20230101T100000Z";
			const expectedDate = new Date("2023-01-01T10:00:00Z");
			assert.deepStrictEqual(parseIcalDateTime(icalDateTime), expectedDate);
		});
		it("should handle local time zone date-time strings", () => {
			const icalDateTime = "20230101T100000"; // Local time
			const expectedDate = new Date("2023-01-01T10:00:00"); // Local time
			assert.deepStrictEqual(parseIcalDateTime(icalDateTime), expectedDate);
		});
	});

	describe("formatToIcalDateTime", () => {
		it("should format a Date object to iCalendar date-time string", () => {
			const date = new Date("2023-01-01T10:00:00Z");
			const expected = "20230101T100000Z";

			assert.strictEqual(formatToIcalDateTime(date), expected);
		});

		it("should handle dates with local time zone", () => {
			const date = new Date("2023-01-01T10:00:00"); // Local time

			// Construct the expected string directly from the UTC components of the 'date' object
			const expectedYear = date.getUTCFullYear().toString();
			const expectedMonth = (date.getUTCMonth() + 1)
				.toString()
				.padStart(2, "0");
			const expectedDay = date.getUTCDate().toString().padStart(2, "0");
			const expectedHours = date.getUTCHours().toString().padStart(2, "0");
			const expectedMinutes = date.getUTCMinutes().toString().padStart(2, "0");
			const expectedSeconds = date.getUTCSeconds().toString().padStart(2, "0");
			const expectedUtcOutput = `${expectedYear}${expectedMonth}${expectedDay}T${expectedHours}${expectedMinutes}${expectedSeconds}Z`;

			assert.strictEqual(formatToIcalDateTime(date, false), expectedUtcOutput);
		});

		it("should format a Date object to iCalendar date-time string using local timezone when timezone=true", () => {
			const date = new Date(2023, 0, 1, 10, 30, 15); // January 1, 2023, 10:30:15 local time

			const expectedYear = date.getFullYear().toString();
			const expectedMonth = (date.getMonth() + 1).toString().padStart(2, "0");
			const expectedDay = date.getDate().toString().padStart(2, "0");
			const expectedHours = date.getHours().toString().padStart(2, "0");
			const expectedMinutes = date.getMinutes().toString().padStart(2, "0");
			const expectedSeconds = date.getSeconds().toString().padStart(2, "0");

			const expected = `${expectedYear}${expectedMonth}${expectedDay}T${expectedHours}${expectedMinutes}${expectedSeconds}`;
			assert.strictEqual(formatToIcalDateTime(date, true), expected);
		});
	});

	describe("mapIcalObjectToEvent", () => {
		it("should map an iCalendar object to an event object", () => {
			const icalObject = singleEventObject;
			const expected: Event = {
				id: "event1@example.com",
				summary: "Test Event",
				start: new Date("2023-01-01T10:00:00.000Z"),
				end: new Date("2023-01-01T11:00:00.000Z"),
				description: "This is a test event with a colon: in the description.",
			};

			assert.deepStrictEqual(mapIcalObjectToEvent(icalObject), expected);
		});
	});

	describe("mapEventToIcalObject", () => {
		it("should map an event object to an iCalendar object", () => {
			const event: Event = {
				id: "event1@example.com",
				summary: "Test Event",
				start: new Date("2023-01-01T10:00:00.000Z"),
				end: new Date("2023-01-01T11:00:00.000Z"),
				description: "This is a test event.",
				location: "Conference Room",
				X_CUSTOM_PROP: "Custom Value",
			};
			const expected = {
				UID: "event1@example.com",
				SUMMARY: "Test Event",
				DTSTART: "20230101T100000Z",
				DTEND: "20230101T110000Z",
				DESCRIPTION: "This is a test event.",
				LOCATION: "Conference Room",
				X_CUSTOM_PROP: "Custom Value",
			};

			assert.deepStrictEqual(mapEventToIcalObject(event), expected);
		});

		it("should map an event object with all standard properties and no custom properties", () => {
			const event: Event = {
				id: "eventStandard@example.com",
				summary: "Standard Event",
				start: new Date("2023-04-01T10:00:00Z"),
				end: new Date("2023-04-01T11:00:00Z"),
				location: "Standard Location",
				description: "Standard Description",
			};
			const expected = {
				UID: "eventStandard@example.com",
				SUMMARY: "Standard Event",
				DTSTART: "20230401T100000Z",
				DTEND: "20230401T110000Z",
				LOCATION: "Standard Location",
				DESCRIPTION: "Standard Description",
			};
			assert.deepStrictEqual(mapEventToIcalObject(event), expected);
		});

		it("should map an event object without an id", () => {
			const event: Event = {
				summary: "Test Event No ID",
				start: new Date("2024-02-15T14:30:00.000Z"),
				end: new Date("2024-02-15T15:30:00.000Z"),
			};
			const expected = {
				SUMMARY: "Test Event No ID",
				DTSTART: "20240215T143000Z",
				DTEND: "20240215T153000Z",
			};
			const result = mapEventToIcalObject(event);
			assert.strictEqual(result.UID, undefined);
			assert.strictEqual(result.SUMMARY, expected.SUMMARY);
			assert.strictEqual(result.DTSTART, expected.DTSTART);
			assert.strictEqual(result.DTEND, expected.DTEND);
		});

		it("should handle event with minimal properties", () => {
			const event: Event = {
				summary: "Minimal Event",
				start: new Date("2023-03-01T00:00:00.000Z"),
				end: new Date("2023-03-01T01:00:00.000Z"),
			};
			const expected = {
				SUMMARY: "Minimal Event",
				DTSTART: "20230301T000000Z",
				DTEND: "20230301T010000Z",
			};
			assert.deepStrictEqual(mapEventToIcalObject(event), expected);
		});

		it("should correctly format dates using formatToIcalDateTime", () => {
			const startDate = new Date("2023-01-01T10:00:00.000Z");
			const endDate = new Date("2023-01-01T11:00:00.000Z");
			const event: Event = {
				summary: "Date Test",
				start: startDate,
				end: endDate,
			};
			const result = mapEventToIcalObject(event);
			assert.strictEqual(result.DTSTART, formatToIcalDateTime(startDate));
			assert.strictEqual(result.DTEND, formatToIcalDateTime(endDate));
		});

		it("should include and uppercase custom properties", () => {
			const event: Event = {
				summary: "Custom Props",
				start: new Date("2023-01-01T10:00:00Z"),
				end: new Date("2023-01-01T11:00:00Z"),
				customField: "value1",
				"another-custom-field": "value2",
			};
			const result = mapEventToIcalObject(event);
			assert.strictEqual(result.CUSTOMFIELD, "value1");
			assert.strictEqual(result["ANOTHER-CUSTOM-FIELD"], "value2");
		});
	});
});
