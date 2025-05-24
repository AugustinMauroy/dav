import type { Event } from "./types.ts";

export function icalToWebDav(icalData: string, baseUrl: string): string {
	const lines = icalData.split("\n");
	const webDavLines: string[] = [];
	let currentLine: string | null = null;

	for (const line of lines) {
		if (line.startsWith("BEGIN:VEVENT")) {
			if (currentLine) {
				webDavLines.push(currentLine);
			}
			currentLine = line;
		} else if (line.startsWith("END:VEVENT")) {
			if (currentLine) {
				webDavLines.push(currentLine);
				currentLine = null;
			}
		} else if (currentLine) {
			currentLine += `\n${line}`;
		}
	}

	if (currentLine) {
		webDavLines.push(currentLine);
	}

	return webDavLines.join("\n");
}

export function webDavToIcal(webDavData: string): string {
	const lines = webDavData.split("\n");
	const icalLines: string[] = [];
	let currentLine: string | null = null;

	for (const line of lines) {
		if (line.startsWith("BEGIN:VEVENT")) {
			if (currentLine) {
				icalLines.push(currentLine);
			}
			currentLine = line;
		} else if (line.startsWith("END:VEVENT")) {
			if (currentLine) {
				icalLines.push(currentLine);
				currentLine = null;
			}
		} else if (currentLine) {
			currentLine += `\n${line}`;
		}
	}

	if (currentLine) {
		icalLines.push(currentLine);
	}

	return icalLines.join("\n");
}

export function parseIcal(icalData: string): Record<string, unknown>[] {
	const events: Record<string, unknown>[] = [];
	const lines = icalData.split("\n");
	let currentEvent: Record<string, unknown> | null = null;

	for (const line of lines) {
		if (line.startsWith("BEGIN:VEVENT")) {
			currentEvent = {};
		} else if (line.startsWith("END:VEVENT")) {
			if (currentEvent) {
				events.push(currentEvent);
				currentEvent = null;
			}
		} else if (currentEvent) {
			const [key, ...valueParts] = line.split(":");
			const value = valueParts.join(":").trim();
			if (key && value) {
				currentEvent[key.trim()] = value;
			}
		}
	}

	return events;
}

export function icalToString(icalData: Record<string, unknown>[]): string {
	const lines: string[] = [];
	for (const event of icalData) {
		lines.push("BEGIN:VEVENT");
		for (const [key, value] of Object.entries(event)) {
			if (key && value) {
				lines.push(`${key}:${value}`);
			}
		}
		lines.push("END:VEVENT");
	}
	return lines.join("\n");
}

export function parseWebDav(webDavData: string): Record<string, unknown>[] {
	const events: Record<string, unknown>[] = [];
	const lines = webDavData.split("\n");
	let currentEvent: Record<string, unknown> | null = null;

	for (const line of lines) {
		if (line.startsWith("BEGIN:VEVENT")) {
			currentEvent = {};
		} else if (line.startsWith("END:VEVENT")) {
			if (currentEvent) {
				events.push(currentEvent);
				currentEvent = null;
			}
		} else if (currentEvent) {
			const [key, ...valueParts] = line.split(":");
			const value = valueParts.join(":").trim();
			if (key && value) {
				currentEvent[key.trim()] = value;
			}
		}
	}

	return events;
}

export function webDavToString(webDavData: Record<string, unknown>[]): string {
	const lines: string[] = [];
	for (const event of webDavData) {
		lines.push("BEGIN:VEVENT");
		for (const [key, value] of Object.entries(event)) {
			if (key && value) {
				lines.push(`${key}:${value}`);
			}
		}
		lines.push("END:VEVENT");
	}
	return lines.join("\n");
}

// Helper to convert iCalendar date-time string to Date object
export function parseIcalDateTime(
	dateTimeStr: string | undefined,
): Date | undefined {
	if (!dateTimeStr) return undefined;
	// Format: YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS or YYYYMMDD
	// This is a simplified parser. For full iCalendar spec compliance (timezones, etc.), a library is better.
	const year = Number.parseInt(dateTimeStr.slice(0, 4), 10);
	const month = Number.parseInt(dateTimeStr.slice(4, 6), 10) - 1; // JS Date months are 0-indexed
	const day = Number.parseInt(dateTimeStr.slice(6, 8), 10);
	let hours = 0;
	let minutes = 0;
	let seconds = 0;

	if (dateTimeStr.length > 8 && dateTimeStr[8] === "T") {
		// Contains time
		hours = Number.parseInt(dateTimeStr.slice(9, 11), 10);
		minutes = Number.parseInt(dateTimeStr.slice(11, 13), 10);
		seconds = Number.parseInt(dateTimeStr.slice(13, 15), 10);
	}

	if (dateTimeStr.endsWith("Z")) {
		return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
	}
	return new Date(year, month, day, hours, minutes, seconds);
}

// Helper to format Date object to iCalendar UTC date-time string (YYYYMMDDTHHMMSSZ)
export function formatToIcalDateTime(date: Date, timezone = false): string {
	if (timezone) {
		return `${
			date.getFullYear().toString() +
			(date.getMonth() + 1).toString().padStart(2, "0") +
			date.getDate().toString().padStart(2, "0")
		}T${date.getHours().toString().padStart(2, "0")}${date.getMinutes().toString().padStart(2, "0")}${date.getSeconds().toString().padStart(2, "0")}`;
	}
	return `${
		date.getUTCFullYear().toString() +
		(date.getUTCMonth() + 1).toString().padStart(2, "0") +
		date.getUTCDate().toString().padStart(2, "0")
	}T${date.getUTCHours().toString().padStart(2, "0")}${date.getUTCMinutes().toString().padStart(2, "0")}${date.getUTCSeconds().toString().padStart(2, "0")}Z`;
}

// Helper to map parsed iCal object (from parseIcal) to our Event interface
export function mapIcalObjectToEvent(icalObj: Record<string, unknown>): Event {
	const event: Partial<Event> & { [key: string]: unknown } = {};
	if (
		typeof icalObj.UID !== "string" ||
		typeof icalObj.SUMMARY !== "string" ||
		typeof icalObj.DTSTART !== "string" ||
		typeof icalObj.DTEND !== "string" ||
		(icalObj.LOCATION !== undefined && typeof icalObj.LOCATION !== "string") ||
		(icalObj.DESCRIPTION !== undefined &&
			typeof icalObj.DESCRIPTION !== "string")
	) {
		throw new Error("Invalid iCal object");
	}

	event.id = icalObj.UID;
	event.summary = icalObj.SUMMARY;
	event.start = parseIcalDateTime(icalObj.DTSTART) as Date; // Assume DTSTART is always present for a valid event
	event.end = parseIcalDateTime(icalObj.DTEND) as Date; // Assume DTEND is always present
	if (icalObj.LOCATION) event.location = icalObj.LOCATION;
	if (icalObj.DESCRIPTION) event.description = icalObj.DESCRIPTION;

	// Copy other properties not explicitly mapped
	for (const key in icalObj) {
		if (
			![
				"UID",
				"SUMMARY",
				"DTSTART",
				"DTEND",
				"LOCATION",
				"DESCRIPTION",
			].includes(key)
		) {
			event[key] = icalObj[key];
		}
	}
	return event as Event; // Cast, assuming essential properties are parsed
}

// Helper to map our Event interface to an iCal object for icalToString
export function mapEventToIcalObject(event: Event): Record<string, unknown> {
	const icalObj: Record<string, unknown> = {};
	if (event.id) icalObj.UID = event.id;
	icalObj.SUMMARY = event.summary;
	icalObj.DTSTART = formatToIcalDateTime(event.start);
	icalObj.DTEND = formatToIcalDateTime(event.end);
	if (event.location) icalObj.LOCATION = event.location;
	if (event.description) icalObj.DESCRIPTION = event.description;

	// Copy other custom properties from event, converting keys to uppercase as per iCal convention
	for (const key in event) {
		if (
			!["id", "summary", "start", "end", "location", "description"].includes(
				key,
			)
		) {
			icalObj[key.toUpperCase()] = event[key];
		}
	}
	return icalObj;
}
