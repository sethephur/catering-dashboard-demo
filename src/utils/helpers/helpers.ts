import { toast } from "sonner";
import { Inquiry } from "../../shared-types";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import expressionParser from "docxtemplater/expressions";
import { saveAs } from "file-saver";
import { parse, format } from "date-fns";
import { database } from "@/utils/firebaseConfig";
import { getContractTemplateOverride } from "@/data/contractTemplates";

export function capitalize(string: string) {
  if (!string) return string;
  return string.toLowerCase().charAt(0).toUpperCase() + string.slice(1);
}

export const formatDate = (inputDate: string) => {
  // Parse a YYYY-MM-DD string as a local date to avoid UTC shifting.
  const date = parse(inputDate, "yyyy-MM-dd", new Date());
  return format(date, "EEEE, MMMM do, yyyy");
};

const asText = (value: unknown) => {
  if (value == null) return "";
  return String(value).trim();
};

const safeFormatDate = (value: unknown) => {
  const text = asText(value);
  if (!text) return "";
  try {
    return formatDate(text);
  } catch {
    return text;
  }
};

const safeFormatTime = (value: unknown) => {
  const text = asText(value);
  if (!text) return "";
  try {
    return convertTo12HourFormat(text);
  } catch {
    return text;
  }
};

const inquiryTemplateValueResolvers: Record<string, (inquiry: Inquiry) => string> = {
  firstName: (inquiry) => capitalize(asText(inquiry.firstName)),
  lastName: (inquiry) => capitalize(asText(inquiry.lastName)),
  fullName: (inquiry) =>
    `${capitalize(asText(inquiry.firstName))} ${capitalize(asText(inquiry.lastName))}`.trim(),
  company: (inquiry) => asText(inquiry.company),
  eventDate: (inquiry) => safeFormatDate(inquiry.eventDate),
  startTime: (inquiry) => safeFormatTime(inquiry.startTime),
  endTime: (inquiry) => safeFormatTime(inquiry.endTime),
  siteAddress: (inquiry) => asText(inquiry.siteAddress),
  email: (inquiry) => asText(inquiry.email),
  phoneNumber: (inquiry) => asText(inquiry.phoneNumber),
  plannedGuestCount: (inquiry) => asText(inquiry.plannedGuestCount),
  operation: (inquiry) => asText(inquiry.operation),
  package: (inquiry) => asText(inquiry.package),
  eventName: (inquiry) => asText(inquiry.eventName),
  reference: (inquiry) => asText(inquiry.reference),
  notes: (inquiry) => asText(inquiry.notes),
};

export const INQUIRY_TEMPLATE_TAGS = [
  { key: "firstName", label: "First Name", token: "{{firstName}}" },
  { key: "lastName", label: "Last Name", token: "{{lastName}}" },
  { key: "fullName", label: "Full Name", token: "{{fullName}}" },
  { key: "company", label: "Company", token: "{{company}}" },
  { key: "eventDate", label: "Event Date", token: "{{eventDate}}" },
  { key: "startTime", label: "Start Time", token: "{{startTime}}" },
  { key: "endTime", label: "End Time", token: "{{endTime}}" },
  { key: "siteAddress", label: "Site Address", token: "{{siteAddress}}" },
  { key: "email", label: "Email", token: "{{email}}" },
  { key: "phoneNumber", label: "Phone Number", token: "{{phoneNumber}}" },
  {
    key: "plannedGuestCount",
    label: "Planned Guest Count",
    token: "{{plannedGuestCount}}",
  },
  { key: "operation", label: "Operation", token: "{{operation}}" },
  { key: "package", label: "Package", token: "{{package}}" },
  { key: "eventName", label: "Event Name", token: "{{eventName}}" },
  { key: "reference", label: "Reference", token: "{{reference}}" },
  { key: "notes", label: "Notes", token: "{{notes}}" },
] as const;

export const renderInquiryTemplate = (template: string, inquiry: Inquiry) => {
  if (!template) return "";
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, rawKey) => {
    const resolver = inquiryTemplateValueResolvers[String(rawKey)];
    if (!resolver) return match;
    return resolver(inquiry);
  });
};

export const BUILT_IN_EMAIL_TEMPLATE_LABELS = {
  generalCateringInquiry: "General Catering Inquiry",
  invoice: "Truck Contract finished",
  initialCartInquiry: "Initial Cart Inquiry",
  basicTwo: "Basic Truck Inquiry Two Options",
  basicThree: "Basic Truck Inquiry Three Options",
  cartAndConeQuestions: "Cart and Cone Questions",
  cartSundaeQuestions: "Cart and Sundae Questions",
  fundraiser: "Truck Fundraiser Inquiry",
  truckForLargerParties: "Truck for larger parties",
  storeReferral: "Store Referral",
  thankYou: "Thank you follow-up",
  alreadyBooked: "Truck Already Booked",
  "50minimum": "50 Minimum",
} as const;

export type BuiltInEmailTemplateKey = keyof typeof BUILT_IN_EMAIL_TEMPLATE_LABELS;

const SEED_EVENT_DATE = "2099-12-31";
const SEED_START_TIME = "13:05";
const SEED_END_TIME = "15:35";

const SEED_TEMPLATE_INQUIRY: Inquiry = {
  docId: null,
  dateCreated: "",
  firstName: "{{firstName}}",
  lastName: "{{lastName}}",
  company: "{{company}}",
  eventDate: SEED_EVENT_DATE,
  startTime: SEED_START_TIME,
  endTime: SEED_END_TIME,
  siteAddress: "{{siteAddress}}",
  email: "{{email}}",
  phoneNumber: "{{phoneNumber}}",
  plannedGuestCount: "{{plannedGuestCount}}",
  operation: "{{operation}}",
  package: "{{package}}",
  eventName: "{{eventName}}",
  reference: "{{reference}}",
  notes: "{{notes}}",
  status: null,
};

const normalizeTokenCase = (value: string) => {
  const tokenMap = new Map(
    INQUIRY_TEMPLATE_TAGS.map((tag) => [tag.key.toLowerCase(), tag.token]),
  );
  return value.replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (match, rawKey: string) => tokenMap.get(rawKey.toLowerCase()) ?? match,
  );
};

export const buildDefaultSavedEmailTemplates = () => {
  const seedDateText = formatDate(SEED_EVENT_DATE);
  const seedStartText = convertTo12HourFormat(SEED_START_TIME);
  const seedEndText = convertTo12HourFormat(SEED_END_TIME);

  return (
    Object.entries(BUILT_IN_EMAIL_TEMPLATE_LABELS) as [
      BuiltInEmailTemplateKey,
      string,
    ][]
  ).map(([systemKey, name]) => {
    const raw = generateEmailTemplate(systemKey, SEED_TEMPLATE_INQUIRY);
    const body = normalizeTokenCase(raw)
      .split(seedDateText)
      .join("{{eventDate}}")
      .split(seedStartText)
      .join("{{startTime}}")
      .split(seedEndText)
      .join("{{endTime}}");

    return {
      systemKey,
      name,
      body,
    };
  });
};

export const generateEmailTemplate = (
  selectedTemplate: string | undefined,
  inquiry: Inquiry,
) => {
  return (() => {
    switch (selectedTemplate) {
    case "generalCateringInquiry":
      return generalCateringInquiry(inquiry);
    case "invoice":
      return generateInvoiceEmailTemplate(inquiry);
    case "initialCartInquiry":
      return initialCartInquiry(inquiry);
    case "basicTwo":
      return truckInquiryTwoOptions(inquiry);
    case "basicThree":
      return generateThreeOptionEmailTemplate(inquiry);
    case "truckAndTableside":
      return generateTruckAndTablesideEmailTemplate(inquiry);
    case "cartAndConeQuestions":
      return cartAndConeQuestions(inquiry);
    case "cartSundaeQuestions":
      return cartSundaeQuestions(inquiry);
    case "fundraiser":
      return generateFundraiserEmailTemplate(inquiry);
    case "wedding":
      return generateWeddingEmailTemplate(inquiry);
    case "truckForLargerParties":
      return generateTruckForLargerPartiesTemplate(inquiry);
    case "storeReferral":
      return generateStoreReferralTemplate(inquiry);
    case "thankYou":
      return generateThankYouEmailTemplate(inquiry);
    case "alreadyBooked":
      return generateTruckAlreadyBookedTemplate(inquiry);
    case "tableside":
      return generateTablesideTemplate(inquiry);
    case "50minimum":
      return generate50MinimumTemplate(inquiry);
    case "ohio":
      return generateOhioTemplate(inquiry);
    default:
      return generateInvoiceEmailTemplate(inquiry);
    }
  })();
};

export const generateInvoiceEmailTemplate = (inquiry: Inquiry) => {
  const template = `Dear ${capitalize(
    inquiry.firstName,
  )},\n\nI have attached the our catering team contract for ${formatDate(
    inquiry.eventDate,
  )}.
  \nPlease look over the information and make sure all is correct and note that we need the signed contract next week. I have also included our W9, truck permit and COI.
\nWould you like to choose your 12 flavors or would you prefer that we bring our top-sellers?  Here is a link to our current flavors: https://example.com/menu
\nAlso, please look at the truck dimensions and make sure they work for the space. I will need either a map or specific directions as to where you would like us to park.
\nPlease make sure to have tickets for all of your guests to hand to us. We aren't able to monitor guests coming back for “seconds” or who are not with your group.
\nWe are so looking forward to bringing the our catering team experience to your ${
    inquiry.eventName ? inquiry.eventName : "event"
  }. Thanks again for thinking of us.

Best,
Catering Team


Inquiry Details:

First Name: ${inquiry.firstName}  
Last Name: ${inquiry.lastName}
Company: ${inquiry.company}
Email: ${inquiry.email}
Phone Number: ${inquiry.phoneNumber}
Event Date: ${formatDate(inquiry.eventDate)}
Start Time: ${convertTo12HourFormat(inquiry.startTime)}
End Time: ${convertTo12HourFormat(inquiry.endTime)}
Site Address: ${inquiry.siteAddress}
Operation: ${inquiry.operation}
Package: ${inquiry.package}
Event Name: ${inquiry.eventName}
Planned Guest Count: ${inquiry.plannedGuestCount}
Notes: ${inquiry.notes}
Reference: ${inquiry.reference}
`;

  return template;
};

// Basic Truck Inquiry Two Options
export const truckInquiryTwoOptions = (inquiry: Inquiry) => {
  const template = `Dear ${capitalize(
    inquiry.firstName,
  )},\n\nI received your catering inquiry for your ${
    inquiry.eventName
  }.
  \nThanks so much for reaching out - we are having so much fun with our truck!  We appreciate the opportunity to celebrate with you.
Right now, we do have ${formatDate(inquiry.eventDate)}, available.

We have two option packages for our truck to bring the catering experience to you:

1. Our “Basic” menu includes our cake cone, sugar cone or dish with 2.5 scoops and up to two flavors, a Kids Bowl with 1.5 scoops, whip cream, sprinkles and a Peep on top,  or a 16 oz. root beer float for $7 per guest. 

2. Our “Premium” menu includes any waffle cone or bowl (plain, sprinkles, nut, chocolate) with 3 scoops with up to 3 flavors, a hot fudge waffle bowl sundae with 2 scoops or a 22 oz. root beer float for $9 per guest. 

We will bring 12 flavors that you can customize yourself or we can bring our top sellers - it's up to you!

We typically come for 2 hours. The standard truck & service fee is $250, but would be determined by your location and number of guests.

Please let me know if you have any questions at all! If you would like to see pictures, please visit @examplecateringdemo or example.com. We look forward to serving you.

Warmly,
Catering Team


Inquiry Details:

First Name: ${inquiry.firstName}  
Last Name: ${inquiry.lastName}
Company: ${inquiry.company}
Email: ${inquiry.email}
Phone Number: ${inquiry.phoneNumber}
Event Date: ${formatDate(inquiry.eventDate)}
Start Time: ${convertTo12HourFormat(inquiry.startTime)}
End Time: ${convertTo12HourFormat(inquiry.endTime)}
Site Address: ${inquiry.siteAddress}
Operation: ${inquiry.operation}
Package: ${inquiry.package}
Event Name: ${inquiry.eventName}
Planned Guest Count: ${inquiry.plannedGuestCount}
Notes: ${inquiry.notes}
Reference: ${inquiry.reference}
`;

  return template;
};

// Basic Truck Inquiry Three Options
export const generateThreeOptionEmailTemplate = (inquiry: Inquiry) => {
  const template = `Dear ${capitalize(
    inquiry.firstName,
  )},\n\nI received your catering inquiry for your ${
    inquiry.eventName
  }.
  \nThanks so much for reaching out - we are having so much fun with our truck!  We appreciate the opportunity to celebrate with you.
Right now, we do have ${formatDate(inquiry.eventDate)}, available.

We have three option packages for our truck to bring the catering experience to you:

  1. Our “Basic” menu includes our cake cone, sugar cone or dish with 2.5 scoops and up to two flavors for $7 per guest. We can also do a Kids' Bowl with this menu and well as a 16 oz root beer float. 

  2. Our “Premium” menu includes any waffle cone or bowl (plain, sprinkles, nut, chocolate) with 3.5 scoops with up to two flavors for $9 per guest. We can also do a hot fudge waffle bowl sundae option for this premium package and a 22 oz root beer float. 

  3. For schools and larger parties, we can also offer a “Mini” menu for $6 on a sugar cone, cake cone or dish with 2 scoops and two flavors.


We will bring 12 flavors that you can customize yourself or we can bring our top sellers - it's up to you!
We typically come for 2 hours. The truck & service fee would be determined by your location and number of guests.

Please let me know if you have any questions at all! If you would like to see pictures, please visit @examplecateringdemo or example.com. We look forward to serving you.

Warmly, 
Catering Team


Inquiry Details:

First Name: ${inquiry.firstName}  
Last Name: ${inquiry.lastName}
Company: ${inquiry.company}
Email: ${inquiry.email}
Phone Number: ${inquiry.phoneNumber}
Event Date: ${formatDate(inquiry.eventDate)}
Start Time: ${convertTo12HourFormat(inquiry.startTime)}
End Time: ${convertTo12HourFormat(inquiry.endTime)}
Site Address: ${inquiry.siteAddress}
Operation: ${inquiry.operation}
Package: ${inquiry.package}
Event Name: ${inquiry.eventName}
Planned Guest Count: ${inquiry.plannedGuestCount}
Notes: ${inquiry.notes}
Reference: ${inquiry.reference}
`;

  return template;
};

// Truck and Tableside Service
export const generateTruckAndTablesideEmailTemplate = (inquiry: Inquiry) => {
  const template = `Dear ${capitalize(
    inquiry.firstName,
  )},\n\nI received your catering inquiry for your ${
    inquiry.eventName
  }.
  \nThanks so much for reaching out - celebrations and are very important to us and we appreciate you thinking of us!

Right now, we do have ${formatDate(
    inquiry.eventDate,
  )}, at ${convertTo12HourFormat(inquiry.startTime)} available.

We have two option packages for our truck to bring the catering experience to you:

  1. Our “Basic” menu includes our cake cone, sugar cone or dish with 2.5 scoops and up to two flavors for $7 per guest. We can also do a Kids' Bowl and a 16 oz. root beer float on this menu.

  2. Our “Premium” menu includes any waffle cone or bowl (plain, sprinkles, nut, chocolate) with 3.5 scoops with up to two flavors for $9 per guest. We can do a hot fudge sundae option and a 22 oz. root beer float for this premium package as well.

We will bring 12 flavors that you can customize yourself or we can bring our top sellers - it's up to you!
We typically come for 2 hours. The truck & service fee would be determined by your location and number of guests.

We also have a tableside service option. I have copied our events coordinator on this email, and she can provide you with that information.

Please let me know if you have any questions at all! If you would like to see pictures, please visit @examplecateringdemo or example.com. We look forward to serving you.


Warmly,
Catering Team


Inquiry Details:

First Name: ${inquiry.firstName}  
Last Name: ${inquiry.lastName}
Company: ${inquiry.company}
Email: ${inquiry.email}
Phone Number: ${inquiry.phoneNumber}
Event Date: ${formatDate(inquiry.eventDate)}
Start Time: ${convertTo12HourFormat(inquiry.startTime)}
End Time: ${convertTo12HourFormat(inquiry.endTime)}
Site Address: ${inquiry.siteAddress}
Operation: ${inquiry.operation}
Package: ${inquiry.package}
Event Name: ${inquiry.eventName}
Planned Guest Count: ${inquiry.plannedGuestCount}
Notes: ${inquiry.notes}
Reference: ${inquiry.reference}
`;

  return template;
};

// Truck Fundraiser Inquiry
export const generateFundraiserEmailTemplate = (inquiry: Inquiry) => {
  const template = `Dear ${capitalize(inquiry.firstName)},\n
Thanks so much for thinking of us for your ${
    inquiry.eventName
  }! I was an educator for 32 years and love working with schools to raise money. 

Here is how our truck fundraiser works:

We are waiving the truck and service fee ($250) for school fundraisers and then providing two menu options that we sell:

1. Our “Basic” package is a cake cone, sugar cone or dish with 2.5 scoops and up to two flavors for $7. We can also do or a Kids’ Bowl with 1.5 scoops, whip cream, sprinkles and a Peep or a 16 oz. root beer float for this package.

2. Our “Premium” package is for any waffle cone or bowl (plain, sprinkles, nuts, chocolate) or dish with 3.5 scoops and up to three flavors for $9. We can also do a hot fudge sundae or a 22 oz. root beer float for this package.

We will bring our top sellers and always include a vegan/dairy-free option and several gluten-free options as well.

Our fundraising scale is:

$1000 - $1500 sold = 10% back
$1500 - $2500 = 15% back
$2500 and above = 20% back
*Please note there is a minimum of $1000 in sales for a percentage back. Usually with 200+ guests at an event when we are the main dessert vendor, we have no problem meeting the $1000.00! 😊

Please let me know if you have any other questions. You can see pictures of our truck @examplecateringdemo or example.com.

Warmly,
Catering Team


Inquiry Details:

First Name: ${inquiry.firstName}  
Last Name: ${inquiry.lastName}
Company: ${inquiry.company}
Email: ${inquiry.email}
Phone Number: ${inquiry.phoneNumber}
Event Date: ${formatDate(inquiry.eventDate)}
Start Time: ${convertTo12HourFormat(inquiry.startTime)}
End Time: ${convertTo12HourFormat(inquiry.endTime)}
Site Address: ${inquiry.siteAddress}
Operation: ${inquiry.operation}
Package: ${inquiry.package}
Event Name: ${inquiry.eventName}
Planned Guest Count: ${inquiry.plannedGuestCount}
Notes: ${inquiry.notes}
Reference: ${inquiry.reference}
`;

  return template;
};

// Wedding Catering Inquiry response
export const generateWeddingEmailTemplate = (inquiry: Inquiry) => {
  const template = `Dear ${capitalize(inquiry.firstName)},\n
I received your inquiry for our catering team for your wedding.

First, congratulations on your engagement! Thanks so much for reaching out - we have loved being a part of wedding celebrations and are very honored that you are considering us. We have supported a wide range of wedding celebrations and would be glad to help.

Right now, we do have ${formatDate(inquiry.eventDate)}, available.

We have two option packages for our truck to bring the catering experience to you:

  1. Our “Basic” package is a cake cone, sugar cone or dish with 2.5 scoops and up to two flavors for $7. We can also do a Kids' Bowl with 1.5 scoops, whip cream, sprinkles and a Peep or a 16 oz. root beer float for this package.

  2. Our “Premium” package is for a waffle cone or bowl (plain, sprinkles, nuts, chocolate) or dish with 3.5 scoops and up to two flavors for $9. We can also do a hot fudge sundae or a 22 oz. root beer float for this package.

We will bring 12 flavors that you can customize yourself or we can bring our top sellers - it's up to you!
We typically come for 2 hours. The truck & service fee would be determined by your location and number of guests.

We also have a tableside service option. I have copied our events coordinator on this email, and she can provide you with that information as well. 

Please let me know if you have any questions at all! If you would like to see pictures, please visit @examplecateringdemo. We look forward to serving you.


Warmly,
Catering Team


Inquiry Details:

First Name: ${inquiry.firstName}  
Last Name: ${inquiry.lastName}
Company: ${inquiry.company}
Email: ${inquiry.email}
Phone Number: ${inquiry.phoneNumber}
Event Date: ${formatDate(inquiry.eventDate)}
Start Time: ${convertTo12HourFormat(inquiry.startTime)}
End Time: ${convertTo12HourFormat(inquiry.endTime)}
Site Address: ${inquiry.siteAddress}
Operation: ${inquiry.operation}
Package: ${inquiry.package}
Event Name: ${inquiry.eventName}
Planned Guest Count: ${inquiry.plannedGuestCount}
Notes: ${inquiry.notes}
Reference: ${inquiry.reference}
`;

  return template;
};

// Truck Thank you follow-up
export const generateThankYouEmailTemplate = (inquiry: Inquiry) => {
  const template = `Dear ${capitalize(inquiry.firstName)},

Thank you again for choosing our catering team for your special day.
Our team enjoyed meeting and serving your guests.
We appreciate you and look forward to partnering with you again! 

Warmly,

`;

  return template;
};

export const generateTruckForLargerPartiesTemplate = (inquiry: Inquiry) => {
  const template = `Dear ${capitalize(inquiry.firstName)},

Thanks so much for reaching out for your ${inquiry.eventName ? inquiry.eventName : "event"} on ${formatDate(
    inquiry.eventDate,
  )}, for ${inquiry.plannedGuestCount} guests for our catering truck.

Unfortunately, our truck is geared towards larger parties, usually 100+ with a $1000 minimum.

However, we do have tableside service available for that day. I have copied our events coordinator, and she can handle all questions.

Attached our Tableside Catering Packages flyer, which includes more details on serving options and what’s included. I’ve also added a few photos so you can get a feel for how our setup looks at events.

Serving Options:
• Sundae Bar with toppings and sauces – $9.00 per serving
• Waffle cone/dish – $7.00
• Small cone/dish – $6.00
• Single-serving pre-packed cup (4 oz and labeled) – $6.00

We offer our signature live scooping cart which includes delivery, set up, full service for 1.5 hours, a personalized sign and tear down. Our standard service fee is $250 (within a 10-mile radius).

Warmly,
Catering Team


Inquiry Details:

First Name: ${inquiry.firstName}  
Last Name: ${inquiry.lastName}
Company: ${inquiry.company}
Email: ${inquiry.email}
Phone Number: ${inquiry.phoneNumber}
Event Date: ${formatDate(inquiry.eventDate)}
Start Time: ${convertTo12HourFormat(inquiry.startTime)}
End Time: ${convertTo12HourFormat(inquiry.endTime)}
Site Address: ${inquiry.siteAddress}
Operation: ${inquiry.operation}
Package: ${inquiry.package}
Event Name: ${inquiry.eventName}
Planned Guest Count: ${inquiry.plannedGuestCount}
Notes: ${inquiry.notes}
Reference: ${inquiry.reference}
`;

  return template;
};

export const generateStoreReferralTemplate = (inquiry: Inquiry) => {
  const template = `Dear ${capitalize(inquiry.firstName)},

Thanks so much for reaching out for catering.
${
  inquiry.siteAddress
} is not in our territory. Please contact your local store for their catering options. 

Warmly,
Catering Team


Inquiry Details:

First Name: ${inquiry.firstName}  
Last Name: ${inquiry.lastName}
Company: ${inquiry.company}
Email: ${inquiry.email}
Phone Number: ${inquiry.phoneNumber}
Event Date: ${formatDate(inquiry.eventDate)}
Start Time: ${convertTo12HourFormat(inquiry.startTime)}
End Time: ${convertTo12HourFormat(inquiry.endTime)}
Site Address: ${inquiry.siteAddress}
Operation: ${inquiry.operation}
Package: ${inquiry.package}
Event Name: ${inquiry.eventName}
Planned Guest Count: ${inquiry.plannedGuestCount}
Notes: ${inquiry.notes}
Reference: ${inquiry.reference}
`;

  return template;
};

export const generateTruckAlreadyBookedTemplate = (inquiry: Inquiry) => {
  const template = `Dear ${capitalize(inquiry.firstName)},

I received your catering inquiry for your ${inquiry.eventName ? inquiry.eventName : "event"}.
Thanks so much for reaching out - we appreciate you thinking of us!

Unfortunately,  the truck is already booked for ${formatDate(
    inquiry.eventDate,
  )}. However, we do have tableside service available for that day. I have copied our events coordinator, and she can handle all questions.

Attached our Tableside Catering Packages flyer, which includes more details on serving options and what’s included. I’ve also added a few photos so you can get a feel for how our setup looks at events.

Serving Options:
• Sundae Bar with toppings and sauces – $9.00 per serving
• Waffle cone/dish – $7.00
• Small cone/dish – $6.00
• Single-serving pre-packed cup (4 oz and labeled) – $6.00

We offer our signature live scooping cart which includes delivery, set up, full service for 1.5 hours, a personalized sign and tear down. Our standard service fee is $250 (within a 10-mile radius).

Warmly,
Catering Team


Inquiry Details:

First Name: ${inquiry.firstName}  
Last Name: ${inquiry.lastName}
Company: ${inquiry.company}
Email: ${inquiry.email}
Phone Number: ${inquiry.phoneNumber}
Event Date: ${formatDate(inquiry.eventDate)}
Start Time: ${convertTo12HourFormat(inquiry.startTime)}
End Time: ${convertTo12HourFormat(inquiry.endTime)}
Site Address: ${inquiry.siteAddress}
Operation: ${inquiry.operation}
Package: ${inquiry.package}
Event Name: ${inquiry.eventName}
Planned Guest Count: ${inquiry.plannedGuestCount}
Notes: ${inquiry.notes}
Reference: ${inquiry.reference}
`;

  return template;
};

export const generateTablesideTemplate = (inquiry: Inquiry) => {
  const template = `Hi ${capitalize(inquiry.firstName)},

My name is the events coordinator, and I oversee all of our catering events here at our catering studio. Thank you so much for reaching out about your upcoming event, ${
    inquiry.eventName
  } on ${formatDate(
    inquiry.eventDate,
  )}! We’re so thankful you’re considering our catering team to be part of your day.
 
I’ve attached our Catering Service Packages flyer, which includes further details on pricing, serving options, and everything that’s included. I’ve also attached a photo guide that’s a nice way to show you what some of our setups can look like—including table displays, personalized signs, and labels to help you get ideas for your event.

We offer a few different options including:
  - Single-serving cups (4oz, labeled, $5 each)
  - Sundae Bar ($8 per serving with toppings and sauces)
  - Ice Cream Sandwiches ($5 each)
 
If you’d like us to be there to handle everything, the Full Service add-on is $275, which includes set up, service for 90 minutes, and clean up. We also offer a Delivery option for $175 within 10 miles.
 
All packages include your choice of up to 6 different ice cream flavors from our current menu.
 
Let me know if you have any questions or if one of the options sounds like a good fit.
 
Thanks again for thinking of us! 😊
 
Best,
Events Coordinator
Catering Manager

Inquiry Details:

First Name: ${inquiry.firstName}  
Last Name: ${inquiry.lastName}
Company: ${inquiry.company}
Email: ${inquiry.email}
Phone Number: ${inquiry.phoneNumber}
Event Date: ${formatDate(inquiry.eventDate)}
Start Time: ${convertTo12HourFormat(inquiry.startTime)}
End Time: ${convertTo12HourFormat(inquiry.endTime)}
Site Address: ${inquiry.siteAddress}
Operation: ${inquiry.operation}
Package: ${inquiry.package}
Event Name: ${inquiry.eventName}
Planned Guest Count: ${inquiry.plannedGuestCount}
Notes: ${inquiry.notes}
Reference: ${inquiry.reference}
`;

  return template;
};

export const generate50MinimumTemplate = (inquiry: Inquiry) => {
  const template = `Hi ${capitalize(inquiry.firstName)},

It’s so nice to connect with you! Thank you for reaching out about your upcoming event ${
    inquiry.eventName
  } on ${formatDate(
    inquiry.eventDate,
  )}. We’re so happy you’re thinking of including our catering studio.
 
Unfortunately, our catering with service has a 50-person minimum. We do offer a pick-up option, which keeps all the fun! I’ve attached our Catering Pick-Up Flyer, which includes all the details on pricing and how it works. Here's a quick overview:

Single-serving cups – 4oz, labeled, $5.00 each
Sundae Bar – $8.00 per serving, includes toppings and sauces
Ice Cream Sandwiches– $5.00 each
 
You can choose up to 6 different ice cream flavors from our current menu offerings. There are no added fees for pick-up, just the cost of the items. If needed, we also offer a freezer bag for $7.00 to help keep everything cold during transport.
 
Let me know if you have any questions—we would love to be a part of your event!
 
Warmly,
Events Coordinator
Catering Manager


Inquiry Details:

First Name: ${inquiry.firstName}  
Last Name: ${inquiry.lastName}
Company: ${inquiry.company}
Email: ${inquiry.email}
Phone Number: ${inquiry.phoneNumber}
Event Date: ${formatDate(inquiry.eventDate)}
Start Time: ${convertTo12HourFormat(inquiry.startTime)}
End Time: ${convertTo12HourFormat(inquiry.endTime)}
Site Address: ${inquiry.siteAddress}
Operation: ${inquiry.operation}
Package: ${inquiry.package}
Event Name: ${inquiry.eventName}
Planned Guest Count: ${inquiry.plannedGuestCount}
Notes: ${inquiry.notes}
Reference: ${inquiry.reference}
`;

  return template;
};

export const generateOhioTemplate = (inquiry: Inquiry) => {
  const template = `Dear ${capitalize(inquiry.firstName)},

Thanks so much for reaching out for catering.
${
  inquiry.siteAddress
} is not in our territory.  We are in your local service area. 😊 Please contact your local store for their catering options. 
 
Warmly,
Catering Team


Inquiry Details:

First Name: ${inquiry.firstName}  
Last Name: ${inquiry.lastName}
Company: ${inquiry.company}
Email: ${inquiry.email}
Phone Number: ${inquiry.phoneNumber}
Event Date: ${formatDate(inquiry.eventDate)}
Start Time: ${convertTo12HourFormat(inquiry.startTime)}
End Time: ${convertTo12HourFormat(inquiry.endTime)}
Site Address: ${inquiry.siteAddress}
Operation: ${inquiry.operation}
Package: ${inquiry.package}
Event Name: ${inquiry.eventName}
Planned Guest Count: ${inquiry.plannedGuestCount}
Notes: ${inquiry.notes}
Reference: ${inquiry.reference}
`;

  return template;
};

export const initialCartInquiry = (inquiry: Inquiry) => {
  const template = `Dear ${capitalize(inquiry.firstName)},

My name is the events coordinator, and I oversee all our tableside catering events here at our catering studio. Thank you so much for reaching out about your upcoming ${inquiry.eventName}. We're so grateful you're considering our catering team to be part of your special day.

Right now, we do have ${formatDate(inquiry.eventDate)}, at ${convertTo12HourFormat(inquiry.startTime)} available.

I've attached our Tableside Catering Packages flyer, which includes more details on serving options and what's included. I've also added a few photos so you can get a feel for how our setup looks at events.

Serving Options:
  • Sundae Bar with toppings and sauces - $9.00 per serving
  • Waffle cone/dish - $7.00
  • Small cone/dish - $6.00
  • Single-serving pre-packed cup (4 oz and labeled) - $6.00

We offer our signature live scooping cart which includes delivery, set up, full service for 1.5 hours, a personalized sign and tear down. Our standard service fee is $250 (within a 10-mile radius).

Please let me know if you have any questions and if any of these options will work for your event. We can always create something custom to fit your needs as well!

Thank you again for thinking of us.

Warmly,
Events Coordinator


Inquiry Details:

First Name: ${inquiry.firstName}  
Last Name: ${inquiry.lastName}
Company: ${inquiry.company}
Email: ${inquiry.email}
Phone Number: ${inquiry.phoneNumber}
Event Date: ${formatDate(inquiry.eventDate)}
Start Time: ${convertTo12HourFormat(inquiry.startTime)}
End Time: ${convertTo12HourFormat(inquiry.endTime)}
Site Address: ${inquiry.siteAddress}
Operation: ${inquiry.operation}
Package: ${inquiry.package}
Event Name: ${inquiry.eventName}
Planned Guest Count: ${inquiry.plannedGuestCount}
Notes: ${inquiry.notes}
Reference: ${inquiry.reference}
`;

  return template;
};

/**
 * Cart and Cone Questions Email Template
 */
export const cartAndConeQuestions = (inquiry: Inquiry) => {
  const template = `Dear ${capitalize(inquiry.firstName)},

I have attached a preliminary invoice for you to look over and confirm that everything is correct. 

I just have a few quick questions to help us get everything ready:

1. Set Up Information
Is there an outlet available for the cart?
Can you confirm there are no steep stairs or gravel? The cart cannot be lifted up stairs.

2. Sign Personalization
Do you have a theme, logo, or color scheme you would like us to use for the flavor sign?

3. Outdoor Setup
If the event is outside, will there be shade available, or should we plan to bring a canopy?

4. Flavor Choices
Please send over your four flavor selections for the catering cups. Here is our current flavor list: https://example.com/menu Some flavors rotate monthly, but I’ll let you know if anything becomes unavailable. I also recommend including a vegan or dairy free option.

5. Payment Information
If everything on the invoice looks correct, I’ll send over a payment link. This includes a 50% deposit to secure your date. If you prefer to pay by check, just let me know.

Please let me know if you have any questions.  

Best,
the events coordinator


Inquiry Details:

First Name: ${inquiry.firstName}  
Last Name: ${inquiry.lastName}
Company: ${inquiry.company}
Email: ${inquiry.email}
Phone Number: ${inquiry.phoneNumber}
Event Date: ${formatDate(inquiry.eventDate)}
Start Time: ${convertTo12HourFormat(inquiry.startTime)}
End Time: ${convertTo12HourFormat(inquiry.endTime)}
Site Address: ${inquiry.siteAddress}
Operation: ${inquiry.operation}
Package: ${inquiry.package}
Event Name: ${inquiry.eventName}
Planned Guest Count: ${inquiry.plannedGuestCount}
Notes: ${inquiry.notes}
Reference: ${inquiry.reference}
`;

  return template;
};

/**
 * Cart and Sundae Questions Email Template
 */
export const cartSundaeQuestions = (inquiry: Inquiry) => {
  const template = `Dear ${capitalize(inquiry.firstName)},

I have attached a preliminary invoice for you to look over and confirm that everything is correct. 

I just have a few quick questions to help us get everything ready:

1. Set Up Information
Is there an outlet available for the cart?
Can you confirm there are no steep stairs or gravel? The cart cannot be lifted up stairs.

2. Sign Personalization
Do you have a theme, logo, or color scheme you would like us to use for the flavor sign?


3. Outdoor Setup
If the event is outside, will there be shade available, or should we plan to bring a canopy?

4. Flavor Choices
Please send over your four flavor selections. Here is our current flavor list: https://example.com/menu
Some flavors rotate monthly, but I’ll let you know if anything becomes unavailable. 

5. Topping Choices
Please choose two sauces and three additional toppings.

Sauce options:
Chocolate
Caramel
Peanut butter
Marshmallow fluff

Additional topping options:
Mixed nuts
Mini M&M’s
Reese’s Pieces
Nerds
Chocolate rainbow chips
Waffle cone bits
Oreo crumbs

6. Payment Information
If everything on the invoice looks correct, I’ll send over a payment link. This includes a 50% deposit to secure your date. If you prefer to pay by check, just let me know.

Please let me know if you have any questions. 

Best,
the events coordinator


Inquiry Details:

First Name: ${inquiry.firstName}  
Last Name: ${inquiry.lastName}
Company: ${inquiry.company}
Email: ${inquiry.email}
Phone Number: ${inquiry.phoneNumber}
Event Date: ${formatDate(inquiry.eventDate)}
Start Time: ${convertTo12HourFormat(inquiry.startTime)}
End Time: ${convertTo12HourFormat(inquiry.endTime)}
Site Address: ${inquiry.siteAddress}
Operation: ${inquiry.operation}
Package: ${inquiry.package}
Event Name: ${inquiry.eventName}
Planned Guest Count: ${inquiry.plannedGuestCount}
Notes: ${inquiry.notes}
Reference: ${inquiry.reference}
`;

  return template;
};

/**
 * General Catering Inquiry Email Template
 */
export const generalCateringInquiry = (inquiry: Inquiry) => {
  const template = `Dear ${capitalize(inquiry.firstName)},

My name is Lisa, and I oversee all our catering events here at our catering studio. Thank you so much for reaching out about your community building event for your company.

We have two on-site catering options:

1. I’ve attached our Tableside Catering Packages flyer. I’ve also added a few photos so you can get a feel for how our setup looks at events.
Serving Options:
  • Sundae Bar with toppings and sauces – $9.00 per serving
  • Waffle cone/dish –$7.00
  • Small cone/dish – $6.00
  • Single-serving pre-packed cup (4 oz and labeled) – $6.00.

We offer our signature live scooping cart which includes delivery, set up, full service for 1.5 hours, a personalized sign and tear down. Our standard service fee is $250 (within a 10-mile radius).

2. We also have our truck! 

• With our “Basic” package, guests get their choice of a cake cone, sugar cone or dish with 2.5 scoops and up to two flavors, a Kids’ Bowl with 1.5 scoops, whip cream, sprinkles and a Peep or a 16 oz. root beer float for $7 per person.

• With our “Premium” package guests get their choice of any waffle cone or bowl (plain, sprinkles, nuts, chocolate) or dish with 3 scoops and up to three flavors, a hot fudge waffle sundae or a 22 oz. root beer float for $9 per person.

We will bring 12 flavors that you can customize yourself or we can bring our top sellers - it’s up to you! Our standard truck service fee for 2 hours is $250 (within a 10-mile radius).

Please let me know if you have any questions or if one of these options sounds like a good fit for your event — we can always create something custom to fit your needs as well.

Thanks again for thinking of us!

Warmly,
Catering Team


Inquiry Details:

First Name: ${inquiry.firstName}  
Last Name: ${inquiry.lastName}
Company: ${inquiry.company}
Email: ${inquiry.email}
Phone Number: ${inquiry.phoneNumber}
Event Date: ${formatDate(inquiry.eventDate)}
Start Time: ${convertTo12HourFormat(inquiry.startTime)}
End Time: ${convertTo12HourFormat(inquiry.endTime)}
Site Address: ${inquiry.siteAddress}
Operation: ${inquiry.operation}
Package: ${inquiry.package}
Event Name: ${inquiry.eventName}
Planned Guest Count: ${inquiry.plannedGuestCount}
Notes: ${inquiry.notes}
Reference: ${inquiry.reference}
`;

  return template;
};

export function convertTo12HourFormat(time24: string): string {
  const [hours24, minutes] = time24.split(":").map(Number);
  const period = hours24 < 12 ? "am" : "pm";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${minutes?.toString().padStart(2, "0")}${period}`;
}

export const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text).then(
    () => {
      toast.success("Copied email template!", { position: "top-center" });
    },
    (err) => {
      toast.warning(`Failed to copy email template: ${err}`, {
        position: "top-center",
      });
    },
  );
};

export function getLabel(key: string): string {
  switch (key) {
    case "dateCreated":
      return "Date";

    case "firstName":
      return "First Name";

    case "lastName":
      return "Last Name";

    case "company":
      return "Company";

    case "eventDate":
      return "Event Date";

    case "startTime":
      return "Start Time";

    case "endTime":
      return "End Time";

    case "siteAddress":
      return "Site Address";

    case "email":
      return "Email";

    case "phoneNumber":
      return "Phone Number";

    case "plannedGuestCount":
      return "Planned Guest Count";

    case "operation":
      return "Operation";

    case "package":
      return "Package";

    case "eventName":
      return "Event Name";

    case "reference":
      return "Reference";

    case "notes":
      return "Notes";

    default:
      return key;
  }
}

export const searchInquiries = (searchValue: string, inquiries: Inquiry[]) => {
  return inquiries.filter((inquiry) =>
    Object.values(inquiry).some((value) =>
      value?.toString().toLowerCase().includes(searchValue.toLowerCase()),
    ),
  );
};

export const highlightText = (text: string, searchValue: string) => {
  if (!searchValue) return [{ text, isMatch: false }];

  const regex = new RegExp(`(${searchValue})`, "gi");
  const parts = text.split(regex);

  return parts.map((part) => ({
    text: part,
    isMatch: part.toLowerCase() === searchValue.toLowerCase(),
  }));
};

/**
 * Contract generation
 *
 */

export type ContractType =
  | "fundraiser"
  | "premium"
  | "basic"
  | "mini"
  | "tableside-cart-waffle"
  | "tableside-catering-cups"
  | "tableside-catering-cups-delivery"
  | "tableside-cart-sundae-bar"
  | "tableside-cart-single-cone-dish";

type ContractConfig = {
  templatePath: string;
  label: string;
  pricePerGuest: number;
  packageDescription: string;
  baseFee: number; // truck/service fee or tableside service fee
  adminFeeRate: number;
};

const PUBLIC_TEMPLATE_PATH = "/templates/demo-contract-template.docx";

const CONTRACT_CONFIG: Record<ContractType, ContractConfig> = {
  fundraiser: {
    templatePath: PUBLIC_TEMPLATE_PATH,
    label: "Fundraiser",
    pricePerGuest: 6.0,
    packageDescription:
      "Choice of cake cone, sugar cone or dish with 2 scoops and up to two flavors",
    baseFee: 250,
    adminFeeRate: 0.01,
  },
  basic: {
    templatePath: PUBLIC_TEMPLATE_PATH,
    label: "Basic",
    pricePerGuest: 7.0,
    packageDescription:
      "Choice of sugar cone, cake cone or dish with 2.5 scoops and up to two flavors",
    baseFee: 250,
    adminFeeRate: 0.01,
  },
  premium: {
    templatePath: PUBLIC_TEMPLATE_PATH,
    label: "Premium",
    pricePerGuest: 9.0,
    packageDescription:
      "Guests have their choice of any waffle cone or bowl (plain, sprinkles, nut, chocolate) with 3 scoops and up to three flavors, a hot fudge waffle bowl sundae with two scoops or a 22 oz. root beer float",
    baseFee: 250,
    adminFeeRate: 0.01,
  },
  mini: {
    templatePath: PUBLIC_TEMPLATE_PATH,
    label: "Mini",
    pricePerGuest: 6.0,
    packageDescription:
      "Choice of cake cone or dish with 2 scoops and up to 2 flavors",
    baseFee: 0,
    adminFeeRate: 0,
  },
  // Public builds ship a single generic placeholder template.
  // Upload contract overrides in Settings for real documents.
  "tableside-cart-waffle": {
    templatePath: PUBLIC_TEMPLATE_PATH,
    label: "Tableside Cart Waffle",
    pricePerGuest: 7.0,
    packageDescription:
      "Two generous scoops of homemade ice cream in a waffle cone ",
    baseFee: 250,
    adminFeeRate: 0.01,
  },
  "tableside-catering-cups": {
    templatePath: PUBLIC_TEMPLATE_PATH,
    label: "Tableside Catering Cups",
    pricePerGuest: 6.0,
    packageDescription: "Single serving 4oz cups with indvidual labels",
    baseFee: 250,
    adminFeeRate: 0.01,
  },
  "tableside-catering-cups-delivery": {
    templatePath: PUBLIC_TEMPLATE_PATH,
    label: "Tableside Premium",
    pricePerGuest: 6.0,
    packageDescription: "Single serving 4oz cups with indvidual labels",
    baseFee: 175,
    adminFeeRate: 0.01,
  },
  "tableside-cart-sundae-bar": {
    templatePath: PUBLIC_TEMPLATE_PATH,
    label: "Tableside Sundae Bar",
    pricePerGuest: 9.0,
    packageDescription: `
2 generous scoops of our homemade ice cream that includes sprinkles, whipped cream & a cherry
• Your choice of 2 sauces: chocolate, caramel, peanut butter, or marshmallow
• Your choice of 3 additional toppings: mixed nuts, mini M & M's, Reeses Pieces, Nerds, chocolate rainbow chips, waffle cone bits, or Oreo crumbs
`,
    baseFee: 250,
    adminFeeRate: 0.01,
  },

  "tableside-cart-single-cone-dish": {
    templatePath: PUBLIC_TEMPLATE_PATH,
    label: "Tableside Single Cone/Dish",
    pricePerGuest: 6.0,
    packageDescription:
      "Two generous scoops of homemade ice cream in a sugar cone, cake cone or dish",
    baseFee: 250,
    adminFeeRate: 0.01,
  },
};

export const CONTRACT_TEMPLATE_OPTIONS = (
  Object.entries(CONTRACT_CONFIG) as [ContractType, ContractConfig][]
).map(([value, config]) => ({
  value,
  label: config.label,
}));

async function loadTemplate(type: ContractType): Promise<ArrayBuffer> {
  let templatePath = CONTRACT_CONFIG[type].templatePath;
  try {
    const override = await getContractTemplateOverride(database, type);
    if (override?.downloadUrl) {
      templatePath = override.downloadUrl;
    }
  } catch (error) {
    console.error("Failed to load contract template override:", error);
  }

  const response = await fetch(templatePath);
  if (!response.ok) {
    throw new Error(`Failed to load .docx template: ${templatePath}`);
  }

  return await response.arrayBuffer();
}

const normalizeWhitespace = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

const toTitleCase = (value: string): string =>
  normalizeWhitespace(value)
    .split(" ")
    .map((word) => {
      if (!word) return word;
      if (/^\d/.test(word)) return word.toUpperCase();
      if (/^[A-Z]{2,3}$/.test(word)) return word;
      return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .join(" ");

const normalizeCityStateZip = (value: string): string => {
  const clean = normalizeWhitespace(value);
  const match = clean.match(
    /^(.*?)(?:,\s*|\s+)([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/,
  );
  if (!match) return toTitleCase(clean);
  return `${toTitleCase(match[1])}, ${match[2].toUpperCase()} ${match[3]}`;
};

const formatContractLocation = (rawAddress: string): string => {
  const withNewlines = (rawAddress ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  if (withNewlines.length >= 2) {
    return withNewlines
      .map((line, idx) =>
        idx === withNewlines.length - 1
          ? normalizeCityStateZip(line)
          : toTitleCase(line),
      )
      .join("\n");
  }

  const singleLine = normalizeWhitespace(rawAddress ?? "");
  if (!singleLine) return "";

  const parts = singleLine
    .split(",")
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);

  if (parts.length >= 3) {
    const cityStateZip = normalizeCityStateZip(
      `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`,
    );
    const startsWithStreetNumber = /^\d/.test(parts[0]);

    if (startsWithStreetNumber) {
      const addressLine = toTitleCase(parts.slice(0, -2).join(", "));
      return [addressLine, cityStateZip].filter(Boolean).join("\n");
    }

    const locationName = toTitleCase(parts[0]);
    const addressParts = parts.slice(1, -2);
    const addressLine = toTitleCase(
      (addressParts.length > 0 ? addressParts : [parts[1]]).join(", "),
    );
    return [locationName, addressLine, cityStateZip].filter(Boolean).join("\n");
  }

  if (parts.length === 2) {
    return [toTitleCase(parts[0]), normalizeCityStateZip(parts[1])]
      .filter(Boolean)
      .join("\n");
  }

  return toTitleCase(parts[0] || singleLine);
};

const formatPhoneForContract = (phone: string): string => {
  const clean = (phone ?? "").trim();
  if (!clean) return "";
  const digits = clean.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return clean;
};

const parseTimeToMinutes = (time: string): number | null => {
  const clean = (time ?? "").trim();
  const match = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
};

const formatMinutesTo12Hour = (minutesFromMidnight: number): string => {
  const normalized = ((minutesFromMidnight % 1440) + 1440) % 1440;
  const hours24 = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const period = hours24 < 12 ? "am" : "pm";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, "0")}${period}`;
};

const formatContractTime = (time: string): string => {
  const minutes = parseTimeToMinutes(time);
  if (minutes === null) return (time ?? "").trim();
  return formatMinutesTo12Hour(minutes);
};

const getArrivalTime = (startTime: string): string => {
  const minutes = parseTimeToMinutes(startTime);
  if (minutes === null) return "";
  return formatMinutesTo12Hour(minutes - 30);
};

export async function generateContract(
  inquiry: Inquiry,
  contractType: ContractType,
) {
  const selectedType = contractType;

  const content = await loadTemplate(selectedType);
  const zip = new PizZip(content);

  const doc = new Docxtemplater(zip, {
    parser: expressionParser,
    paragraphLoop: true,
    linebreaks: true,
  });

  // Drive pricing/description from the selected contract type.
  const cfg = CONTRACT_CONFIG[selectedType];

  const pricePerGuest = cfg.pricePerGuest;
  const packageDescription = cfg.packageDescription;
  const baseFee = cfg.baseFee;
  const adminFeeRate = cfg.adminFeeRate;
  const guestCount = parseInt(inquiry.plannedGuestCount || "0", 10) || 0;
  const price = pricePerGuest * guestCount;
  const adminFee = price * adminFeeRate;
  const grandTotal = price + baseFee + adminFee;
  const depositAmount = grandTotal * 0.5;
  const remainingBalance = grandTotal - depositAmount;
  const siteContact = `${capitalize(inquiry.firstName)} ${capitalize(
    inquiry.lastName,
  )}`.trim();
  const siteContactPhone = formatPhoneForContract(inquiry.phoneNumber);
  const start = formatContractTime(inquiry.startTime);
  const end = formatContractTime(inquiry.endTime);
  const arrival = getArrivalTime(inquiry.startTime) || start;
  const locationForContract = formatContractLocation(inquiry.siteAddress);
  const grandTotalBlock = [
    grandTotal.toFixed(2),
    `$${depositAmount.toFixed(2)}`,
    `$${remainingBalance.toFixed(2)}`,
  ].join("\n");

  const data = {
    ...inquiry,
    contractType: cfg.label,
    fullName: siteContact,
    siteContact: siteContact,
    siteContactPhone: siteContactPhone,
    phone: siteContactPhone,
    pricePerGuest: pricePerGuest.toFixed(2),
    price: price.toFixed(2),
    baseFee: baseFee.toFixed(2),
    packageDescription: packageDescription,
    adminFee: adminFee.toFixed(2),
    grandTotal: grandTotalBlock,
    depositAmount: depositAmount.toFixed(2),
    remainingBalance: remainingBalance.toFixed(2),
    start: start,
    end: end,
    arrival: arrival,
    siteAddress: locationForContract,
    eventLocation: locationForContract,
    eventDate: formatDate(inquiry.eventDate),
  };

  try {
    await doc.renderAsync(data);
    toast.success("Document downloaded!");
  } catch (error: any) {
    console.error("Template rendering failed", error);
    toast.error("Template rendering failed", error);
    if (error.properties?.errors instanceof Array) {
      error.properties.errors.forEach((e: any) =>
        console.error("Template Error:", e),
      );
    }
    throw error;
  }

  const out = doc.getZip().generate({ type: "blob" });
  const typeLabel = ` (${cfg.label})`;
  saveAs(
    out,
    `Contract${typeLabel} - ${inquiry.firstName} ${inquiry.lastName}.docx`,
  );
}
