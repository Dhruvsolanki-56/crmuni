export type CalendarMeeting = { id:string;title:string;startsAt:number;endsAt:number;location:string|null;agenda:string|null;status:string };
export type CalendarParticipant = { name:string|null;email:string };

export function escapeIcsText(value:string){return value.replaceAll('\\','\\\\').replaceAll('\r','').replaceAll('\n','\\n').replaceAll(';','\\;').replaceAll(',','\\,');}
export function escapeIcsParameter(value:string){return value.replaceAll('^','^^').replaceAll('\r','').replaceAll('\n','^n').replaceAll('"',"^'");}
export function formatIcsDate(value:number){return new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');}

export function buildMeetingIcs(meeting:CalendarMeeting,participants:CalendarParticipant[],generatedAt:number){
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//CRMUNI//Revenue OS//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',`UID:${escapeIcsText(meeting.id)}@crmuni.local`,`DTSTAMP:${formatIcsDate(generatedAt)}`,`DTSTART:${formatIcsDate(meeting.startsAt)}`,`DTEND:${formatIcsDate(meeting.endsAt)}`,`SUMMARY:${escapeIcsText(meeting.title)}`,`STATUS:${meeting.status==='cancelled'?'CANCELLED':meeting.status==='complete'?'CONFIRMED':'TENTATIVE'}`];
  if(meeting.location)lines.push(`LOCATION:${escapeIcsText(meeting.location)}`);if(meeting.agenda)lines.push(`DESCRIPTION:${escapeIcsText(meeting.agenda)}`);for(const participant of participants)lines.push(`ATTENDEE;CN="${escapeIcsParameter(participant.name||participant.email)}":mailto:${participant.email}`);lines.push('END:VEVENT','END:VCALENDAR','');return lines.join('\r\n');
}
