/*
TODO:
- Implement full `listCalendars` method:
  - Perform PROPFIND request.
  - Robustly parse multistatus XML response to identify calendar collections.
  - Extract properties like displayname, resourcetype, supported-calendar-component-set, getctag.
- Enhance XML Parsing in `getEvents`:
  - Replace or significantly improve the current simplified XML parsing.
  - Ensure compatibility with various CalDAV server responses.
- Implement ETag Handling for `updateEvent`:
  - Fetch ETag of the event before updating.
  - Use `If-Match` header with the ETag in the PUT request for concurrency control.
- Add Calendar Management Operations:
  - `createCalendar(calendarPath, properties)`: MKCALENDAR request.
  - `deleteCalendar(calendarPath)`: DELETE request.
  - `updateCalendarProperties(calendarPath, properties)`: PROPPATCH request.
- Add Support for Other iCalendar Components:
  - Extend `getEvents` and related methods to handle VTODO (tasks) and VJOURNAL (journal entries).
  - Update `mapEventToIcalObject` and `mapIcalObjectToEvent` or create new mappers.
- Implement Advanced Authentication:
  - Add support for OAuth2 or other relevant authentication mechanisms beyond Basic Auth.
- Implement CTag (Calendar Collection ETag) Handling:
  - Store and use CTags for calendar collections to enable efficient synchronization (fetch only changes).
- Refine Error Handling:
  - Provide more specific error types or codes for different CalDAV/HTTP errors.
- Improve `addEvent` ID generation:
  - Consider more robust UID generation strategies if server doesn't assign one or if client-side UIDs are preferred.
- Add method to fetch a single event by its URL/UID directly.
*/
import {
	parseIcal,
	icalToString,
	formatToIcalDateTime,
	mapEventToIcalObject,
	mapIcalObjectToEvent,
} from "./ical.ts";
import type { Event } from "./types.ts";

interface CalDAVClientOptions {
	url: string; // Base URL of the CalDAV server, e.g., https://dav.example.com/
	username?: string;
	password?: string;
	// Potentially add other options like authType, etc.
}

interface GetEventsOptions {
	startDate?: Date;
	endDate?: Date;
	// Filtering by specific event UIDs (ids) in a single REPORT is complex.
	// Typically, if UIDs are known, events are fetched by their individual URLs.
	// ids?: string[];
}

export class CalDAVClient {
	private baseUrl: string;
	private username?: string;
	private password?: string;
	private authHeader?: string;

	constructor(options: CalDAVClientOptions) {
		this.baseUrl = options.url.endsWith("/") ? options.url : `${options.url}/`;
		this.username = options.username;
		this.password = options.password;

		if (this.username && this.password) {
			// btoa is a standard global function in browsers and Deno, and available in Node.js >= 16.0.0
			this.authHeader = `Basic ${typeof btoa === "function" ? btoa(`${this.username}:${this.password}`) : Buffer.from(`${this.username}:${this.password}`).toString("base64")}`;
		}
	}

	private async _request(
		method: string,
		fullUrl: string, // Expects the full URL for the request
		body?: string | Document, // Body can be string (iCal, XML) or XML Document
		additionalHeaders?: Record<string, string>,
		expectedStatus: number[] = [200, 201, 204, 207], // 207 for multistatus
	): Promise<Response> {
		const headers: Record<string, string> = {
			Depth: "1", // Common for CalDAV, can be overridden
			...additionalHeaders,
		};
		if (this.authHeader) {
			headers.Authorization = this.authHeader;
		}

		const response = await fetch(fullUrl, {
			method,
			headers,
			body:
				body instanceof Document
					? new XMLSerializer().serializeToString(body)
					: body,
		});

		if (!expectedStatus.includes(response.status)) {
			const errorBody = await response.text();
			throw new Error(
				`HTTP error ${response.status} ${response.statusText} for ${method} ${fullUrl}. Response: ${errorBody}`,
			);
		}
		return response;
	}

	async getEvents(
		calendarPath: string, // Path to the calendar, e.g., "calendars/user/default/"
		options?: GetEventsOptions,
	): Promise<Event[]> {
		const calendarUrl = new URL(calendarPath, this.baseUrl).href;
		let reportXmlBody = `
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag/>
    <c:calendar-data>
      <c:comp name="VCALENDAR">
        <c:prop name="VERSION"/>
        <c:comp name="VEVENT">
          <c:prop name="SUMMARY"/>
          <c:prop name="UID"/>
          <c:prop name="DTSTART"/>
          <c:prop name="DTEND"/>
          <c:prop name="DESCRIPTION"/>
          <c:prop name="LOCATION"/>
          <!-- Add any other VEVENT properties you need -->
        </c:comp>
      </c:comp>
    </c:calendar-data>
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">`;

		if (options?.startDate || options?.endDate) {
			reportXmlBody += "<c:time-range";
			if (options.startDate) {
				reportXmlBody += ` start="${formatToIcalDateTime(options.startDate)}"`;
			}
			if (options.endDate) {
				reportXmlBody += ` end="${formatToIcalDateTime(options.endDate)}"`;
			}
			reportXmlBody += "/>";
		}
		reportXmlBody += `
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;

		const response = await this._request("REPORT", calendarUrl, reportXmlBody, {
			"Content-Type": "application/xml; charset=utf-8",
			Depth: "1",
		});

		const responseText = await response.text();
		const events: Event[] = [];

		// !!! CRITICAL: Proper XML parsing is required here for production use.
		// The following is a simplified approach and might not work with all CalDAV servers.
		// Consider using DOMParser (browser/Deno) or a library like 'xml2js' (Node.js).
		if (typeof DOMParser !== "undefined") {
			const parser = new DOMParser();
			const xmlDoc = parser.parseFromString(responseText, "application/xml");
			const calendarDataElements = xmlDoc.getElementsByTagNameNS(
				"urn:ietf:params:xml:ns:caldav",
				"calendar-data",
			);
			for (let i = 0; i < calendarDataElements.length; i++) {
				const calData = calendarDataElements[i].textContent || "";
				if (calData.includes("BEGIN:VEVENT")) {
					for (const obj of parseIcal(calData))
						events.push(mapIcalObjectToEvent(obj));
				}
			}
		} else {
			// Fallback for environments without DOMParser (e.g. older Node.js without polyfill)
			// This is a very naive regex approach and likely to fail with complex XML.
			console.warn(
				"DOMParser not available. Using naive regex for XML parsing in getEvents. This is not robust.",
			);
			const matches = responseText.matchAll(
				/<c:calendar-data>([\s\S]*?)<\/c:calendar-data>/gi,
			);
			for (const match of matches) {
				const calData = match[1];
				if (calData.includes("BEGIN:VEVENT")) {
					for (const obj of parseIcal(calData))
						events.push(mapIcalObjectToEvent(obj));
				}
			}
		}
		return events;
	}

	async addEvent(calendarPath: string, event: Event): Promise<Event> {
		const eventId =
			event.id || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
		const eventFileName = `${eventId}.ics`;
		const calendarBaseUrl = new URL(calendarPath, this.baseUrl).href;
		const eventUrl = new URL(
			eventFileName,
			calendarBaseUrl.endsWith("/") ? calendarBaseUrl : `${calendarBaseUrl}/`,
		).href;

		const icalObject = mapEventToIcalObject({ ...event, id: eventId }); // Ensure UID is set in the object
		// CalDAV expects a full iCalendar object (VCALENDAR wrapping VEVENT)
		const icalData = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//dav-js//CalDAVClient 1.0//EN\n${icalToString([icalObject])}\nEND:VCALENDAR`;

		await this._request(
			"PUT",
			eventUrl,
			icalData,
			{
				"Content-Type": "text/calendar; charset=utf-8",
				"If-None-Match": "*", // Ensures creation, fails if resource exists
			},
			[201, 204],
		); // 201 Created or 204 No Content on success

		return { ...event, id: eventId }; // Return the event with the (potentially generated) ID
	}

	async updateEvent(calendarPath: string, event: Event): Promise<boolean> {
		if (!event.id) {
			throw new Error("Event ID (UID) is required for updates.");
		}
		const eventFileName = `${event.id}.ics`;
		const calendarBaseUrl = new URL(calendarPath, this.baseUrl).href;
		const eventUrl = new URL(
			eventFileName,
			calendarBaseUrl.endsWith("/") ? calendarBaseUrl : `${calendarBaseUrl}/`,
		).href;

		const icalObject = mapEventToIcalObject(event);
		const icalData = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//dav-js//CalDAVClient 1.0//EN\n${icalToString([icalObject])}\nEND:VCALENDAR`;

		// For robust updates, use ETag with "If-Match" header. This is simplified.
		await this._request(
			"PUT",
			eventUrl,
			icalData,
			{
				"Content-Type": "text/calendar; charset=utf-8",
			},
			[200, 204],
		); // 200 OK or 204 No Content
		return true;
	}

	async deleteEvent(calendarPath: string, eventId: string): Promise<boolean> {
		if (!eventId) {
			throw new Error("Event ID (UID) is required for deletion.");
		}
		const eventFileName = `${eventId}.ics`;
		const calendarBaseUrl = new URL(calendarPath, this.baseUrl).href;
		const eventUrl = new URL(
			eventFileName,
			calendarBaseUrl.endsWith("/") ? calendarBaseUrl : `${calendarBaseUrl}/`,
		).href;

		await this._request("DELETE", eventUrl, undefined, {}, [200, 204, 404]); // 404 if already deleted is ok
		return true;
	}

	// Placeholder for listing calendars (requires PROPFIND and more complex XML parsing)
	async listCalendars(
		userPrincipalPath = "principals/users/me/",
	): Promise<unknown[]> {
		const principalUrl = new URL(userPrincipalPath, this.baseUrl).href;
		const propfindBody = `
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">
  <d:prop>
    <d:displayname/>
    <d:resourcetype/>
    <c:supported-calendar-component-set/>
    <cs:getctag/>
    <!-- Add other properties of interest -->
  </d:prop>
</d:propfind>`;
		console.warn(
			`listCalendars is a placeholder. It would make a PROPFIND request to ${principalUrl} or a calendar home set URL. Full implementation requires robust XML parsing of the multistatus response to identify calendar collections.`,
		);
		// const response = await this._request("PROPFIND", principalUrl, propfindBody, {
		//     "Content-Type": "application/xml; charset=utf-8",
		//     "Depth": "1" // Or "0" for properties of the principalUrl itself
		// });
		// const responseText = await response.text();
		// Parse XML (e.g. using DOMParser) to find <d:response> elements for calendar collections.
		return [];
	}
}
