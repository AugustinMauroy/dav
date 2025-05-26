// @ts-nocheck - this file will not be run, it's just for reflection purposes
/**
 * @fileoverview just me that make some reflection about how the package's apis are structured
 *
 */
import { CalDAVClient } from "";

const client = new CalDAVClient({
	url: "https://your-caldav-server.com",
	username: "your-username",
	password: "your-password",
});

const events = await client.getEvents("your-calendar-id", {
	// options
});

const newEvent = {
	summary: "Meeting with Team",
	start: new Date("2023-10-10T10:00:00"),
	end: new Date("2023-10-10T11:00:00"),
	location: "Conference Room",
	description: "Discuss project updates",
};

const addedEvent = await client.addEvent("your-calendar-id", newEvent);

const updatedEvent = {
	id: "your-event-id",
	summary: "Updated Meeting with Team",
	start: new Date("2023-10-10T10:00:00"),
	end: new Date("2023-10-10T11:30:00"),
	location: "Conference Room",
	description: "Discuss project updates and next steps",
};

const result = await client.updateEvent("your-calendar-id", updatedEvent);

const deletedEvent = await client.deleteEvent(
	"your-calendar-id",
	"your-event-id",
);
