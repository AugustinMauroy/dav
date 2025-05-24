export interface Event {
	id?: string; // UID of the event, used as the resource name (e.g., eventId.ics)
	summary: string;
	start: Date;
	end: Date;
	location?: string;
	description?: string;
	// Add other common iCalendar properties as needed
	[key: string]: unknown; // Allow additional properties
}
