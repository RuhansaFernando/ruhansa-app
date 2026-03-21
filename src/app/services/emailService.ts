import emailjs from '@emailjs/browser';

const SERVICE_ID = 'service_y8aewpn';
const TEMPLATE_ID = 'template_jb2afwx';
const PUBLIC_KEY = 'pqfkLZ1zbahk5O2Vi';

export interface MentorAssignmentEmailParams {
  student_name: string;
  student_email: string;
  mentor_name: string;
  mentor_department: string;
  mentor_calendar_link: string;
}

export async function sendMentorAssignmentEmail(
  params: MentorAssignmentEmailParams
): Promise<void> {
  try {
    await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      {
        student_name: params.student_name,
        student_email: params.student_email,
        mentor_name: params.mentor_name,
        mentor_department: params.mentor_department,
        mentor_calendar_link: params.mentor_calendar_link,
      },
      PUBLIC_KEY
    );
    console.log(`Email sent to ${params.student_email}`);
  } catch (err) {
    console.error('EmailJS error:', err);
  }
}
