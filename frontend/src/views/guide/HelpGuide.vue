<script setup>
import { ref, computed } from 'vue';

const lang = ref('en');
const toggle = () => lang.value = lang.value === 'en' ? 'ta' : 'en';
const t = computed(() => lang.value === 'en' ? en : ta);

const sections = [
  'dashboard', 'quotations', 'invoices', 'clients', 'jobs',
  'delivery', 'drivers', 'fleet', 'reports', 'users', 'catalog', 'settings',
];

const activeSection = ref('dashboard');

const en = {
  title: 'User Guide',
  subtitle: 'Complete guide for AKB Transport & Logistics system',
  langBtn: 'தமிழில் படிக்க',
  toc: 'Contents',
  gettingStarted: 'Getting Started',
  workflow: 'Standard Workflow',

  dashboard: {
    nav: 'Dashboard',
    title: 'Dashboard',
    desc: 'Your central hub showing a live snapshot of the business — revenue, outstanding invoices, active deliveries, and a monthly revenue chart.',
    steps: [
      'Revenue (MTD) — total invoiced amount for the current month.',
      'Revenue (YTD) — total invoiced amount for the current calendar year.',
      'Outstanding — total unpaid invoice amount; shown in orange as a warning.',
      'Active Deliveries — number of open delivery records.',
      "Monthly Revenue chart — bar chart of each month's invoiced total.",
      'Recent Invoices panel — quick links to the latest invoices.',
    ],
  },

  quotations: {
    nav: 'Quotations',
    title: 'Quotations',
    desc: 'Create price quotes for clients before work begins. A quotation can be converted to an invoice once the client accepts.',
    steps: [
      'Go to Quotations → click "+ New Quotation".',
      'Select the Client and enter the Date and Valid Until date.',
      'Add line items: click "+ Service" for a rate-based item, or "+ Delivery" for trip-based items.',
      'Service items: fill in description, From Date, To Date, and rate (per day or per week).',
      'Delivery items: fill in description and unit price, then add one or more delivery dates using the date chip bar — click "+ Add" for each date. Quantity auto-fills from the number of dates.',
      'Use the search box in the description field to pick from the Item Catalog for common service descriptions and auto-fill prices.',
      'Dates are mandatory — From/To for service items and at least one date for delivery items.',
      'Click Save. The quotation gets a unique number (e.g. QUO-0001) — the prefix and starting number are configurable in Settings, and can be overridden per client on the client\'s edit page.',
      'Open the quotation detail → click "View PDF" to open the PDF in browser (you can print or download from there).',
      'Click "Send Email" to email the PDF directly to the client (requires the client to have an email address on file).',
      'If the client has no email, or you\'d rather update the status manually: use "Mark as Sent", "Mark as Accepted", or "Mark as Rejected" on the quotation detail page.',
      'Once sent or accepted, click "Convert to Invoice" to create the invoice directly from the quotation — it fills in the client and items automatically and marks the quotation as converted.',
    ],
  },

  invoices: {
    nav: 'Invoices',
    title: 'Invoices',
    desc: 'Manage all invoices. Track payment status, view PDFs inline, send emails, and record payments.',
    steps: [
      'Go to Invoices to see the full list with status badges (Draft, Sent, Paid, Overdue).',
      'Click an invoice number to open the detail view.',
      'Click "View PDF" to open the invoice PDF directly in the browser — you can print or download from the PDF viewer.',
      'Click "Send Email" to email the invoice to the client.',
      'Click "Record Payment" to mark all or part of the invoice as paid. The balance updates automatically.',
      'Status changes to Paid once the full amount is recorded; the PDF shows "PAID IN FULL".',
      'You can also create an invoice directly: Invoices → "+ New Invoice".',
      'On the New Invoice screen, "Load from Quotation" (optional) lets you pick an existing quotation to pre-fill the client and line items — you can still edit everything before saving. This marks that quotation as converted, so it can\'t be loaded again.',
      'Delivery line items support multiple dates — add each delivery date as a chip. Quantity and total update automatically. The PDF prints each date as its own row.',
    ],
  },

  clients: {
    nav: 'Clients',
    title: 'Clients',
    desc: 'Manage your client companies. Each client has a unique client code used in quotation and invoice numbers.',
    steps: [
      'Go to Clients → click "+ New Client" to add a company.',
      'Fill in Company Name, Client Code (e.g. SMM), Contact Person, Email, Phone, and Address.',
      'Optionally, set a custom invoice/quotation number prefix and starting number just for this client — otherwise the global prefix from Settings is used.',
      'Click the edit icon to update client details.',
      'Search clients by name or code using the search bar.',
    ],
  },

  jobs: {
    nav: 'Jobs',
    title: 'Jobs',
    desc: 'Create and assign transport jobs to drivers. Drivers see their jobs from the mobile-friendly job list.',
    steps: [
      'Go to Jobs → click "+ New Job" to create a job.',
      'Select Client, assign a Driver, set the pickup and drop-off locations and scheduled date.',
      'Add job description and any special notes.',
      'Click Save. The driver sees this job in their "My Jobs" view.',
      'Open a job to see status updates from the driver (In Progress, Completed).',
      'Admin/Staff can update or close jobs from the job detail page.',
    ],
  },

  delivery: {
    nav: 'Delivery Log',
    title: 'Delivery Log',
    desc: 'Record individual delivery trips with item details, quantity, and pricing. Use "Generate Invoice" to bundle multiple deliveries into a single invoice.',
    steps: [
      'Go to Delivery Log → click "+ New Delivery" to record a trip.',
      'Select Client, Driver, and Vehicle. Enter delivery date.',
      'Add items: description (pick from catalog or type freely), quantity, and unit price.',
      'Click Save. The delivery appears in the list with status "pending".',
      'To invoice multiple deliveries: tick the checkboxes → click "Generate Invoice".',
      'Review the bundled items and click "Create Invoice" — all selected deliveries are marked "invoiced".',
      'Click "View PDF" on the generated invoice to open it in the browser for printing or saving.',
    ],
  },

  drivers: {
    nav: 'Drivers',
    title: 'Drivers',
    desc: 'Add drivers and manage their license details. Creating a driver automatically creates a login account they can use to view jobs and log deliveries.',
    steps: [
      'Go to Drivers → click "+ Add Driver".',
      'Enter Name, Email, Phone, and Password — these become the driver\'s login credentials.',
      'Optionally set License Number, License Expiry, and Assigned Vehicle.',
      'Click Save. The driver can now log in and see their assigned jobs.',
      'To update details, click the edit icon on the driver card.',
      'Deactivate a driver by toggling the Active switch — they will not be able to log in.',
      'Driver accounts cannot be created or edited from the Users page (admin-only restriction).',
    ],
  },

  fleet: {
    nav: 'Fleet',
    title: 'Fleet (Vehicles)',
    desc: 'Keep a register of all your vehicles. Vehicles are linked to drivers and delivery records.',
    steps: [
      'Go to Fleet → click "+ Add Vehicle" to register a vehicle.',
      'Enter Plate Number, Vehicle Type (Truck / Van / Lorry), Size, and any notes.',
      'Click Save. The vehicle is now available to assign to drivers and deliveries.',
      'Click the edit icon to update details such as plate number or type.',
    ],
  },

  reports: {
    nav: 'Reports',
    title: 'Reports',
    desc: 'View financial summaries — revenue by period, client breakdown, and outstanding invoices.',
    steps: [
      'Go to Reports and select the date range (Month / Quarter / Year or custom).',
      'Revenue Summary shows total invoiced, total collected, and balance outstanding.',
      'Client Breakdown shows per-client totals for the selected period.',
      'Outstanding Invoices lists all unpaid invoices sorted by due date.',
      'Use the Export button to download the report as CSV.',
    ],
  },

  users: {
    nav: 'Users',
    title: 'Users (Admin & Staff)',
    desc: 'Manage admin and staff login accounts. Only Admin role can access this page. Driver accounts are managed separately on the Drivers page.',
    steps: [
      'Go to Users → click "+ New User" to add a staff or admin account.',
      'Enter Name, Email, Phone, Password, and select Role (Admin or Staff).',
      'Admin: full access to all pages including Users, Settings, and Item Catalog.',
      'Staff: can create quotations, invoices, clients, jobs, and deliveries — but not manage users or settings.',
      'Click the edit icon to update name, email, or role.',
      'Toggle the Active switch to enable/disable a user account.',
    ],
  },

  catalog: {
    nav: 'Item Catalog',
    title: 'Item Catalog',
    desc: 'Maintain a library of common service descriptions. When adding items to quotations, invoices, or deliveries, you can search and auto-fill from this catalog.',
    steps: [
      'Go to Item Catalog → click "+ New Item" to add a description.',
      'Enter the Description text (e.g. "Transportation of machinery from Port to Factory").',
      'Optionally set a default Unit Price.',
      'Click Save. The item is now searchable from any quotation or delivery form.',
      'Start typing in the Description field on a form — matching catalog items appear as suggestions.',
      'Click a suggestion to auto-fill the description (and price if set).',
    ],
  },

  settings: {
    nav: 'Settings',
    title: 'Settings',
    desc: 'Configure company information, branding, and default payment terms. This data appears on all PDFs, the browser tab, and the sidebar.',
    steps: [
      'Go to Settings → fill in Company Name, Registration No., Address, Phone, and Email.',
      'Company Logo: click "Upload Logo" to upload your company logo image (PNG/JPG recommended). It appears on all PDF invoices, quotations, and reports, and in the on-screen document previews. The browser tab title also updates to your company name.',
      'Logo Initials: set 3 letters shown in the sidebar badge when no logo image is uploaded.',
      'Set Currency Symbol (default S$) and Currency Code (default SGD).',
      'Set Payment Terms Days — used in the Terms & Conditions section of PDFs.',
      'Set Signatory Name — the authorised signatory name that appears on PDF documents.',
      'Seal & Signature: upload a company seal image and a handwritten signature image. Both appear above the signatory line on every PDF.',
      'Test Mode (super admin / designated test account only): switch this on to safely demo creating invoices/quotations/clients without touching real data. While it\'s on, a "TEST MODE ACTIVE" banner appears everywhere, new records are tagged as dummy data with a distinct number series (e.g. TEST-INV-0001), and only that dummy data is shown until you switch it back off — real data is hidden, not deleted. Reports and revenue figures always reflect real data only, regardless of this toggle.',
      'Click "Save Changes" to apply all changes immediately.',
    ],
  },

  workflowSteps: [
    { icon: 'business', label: 'Add Client', desc: 'Create the client company record with contact details.' },
    { icon: 'description', label: 'Create Quotation', desc: 'Build a price quote with line items and send PDF to client.' },
    { icon: 'check_circle', label: 'Client Accepts', desc: 'Click "Convert to Invoice" on the accepted quotation.' },
    { icon: 'receipt_long', label: 'Invoice Sent', desc: 'Email the invoice PDF and track payment status.' },
    { icon: 'payments', label: 'Record Payment', desc: 'Log the payment — invoice status changes to Paid.' },
  ],
};

const ta = {
  title: 'பயனர் வழிகாட்டி',
  subtitle: 'AKB Transport & Logistics அமைப்பின் முழுமையான வழிகாட்டி',
  langBtn: 'Read in English',
  toc: 'உள்ளடக்கம்',
  gettingStarted: 'தொடக்க வழிகாட்டுதல்',
  workflow: 'நிலையான பணிமுறை',

  dashboard: {
    nav: 'டாஷ்போர்டு',
    title: 'டாஷ்போர்டு (Dashboard)',
    desc: 'வணிகத்தின் நேரடி நிலையை காட்டும் மையப்பக்கம் — வருவாய், செலுத்தப்படாத விலைப்பட்டியல்கள், செயலில் உள்ள டெலிவரிகள் மற்றும் மாதாந்திர வருவாய் வரைபடம்.',
    steps: [
      'Revenue (MTD) — இந்த மாதத்தில் மொத்த விலைப்பட்டியல் தொகை.',
      'Revenue (YTD) — இந்த ஆண்டில் மொத்த விலைப்பட்டியல் தொகை.',
      'Outstanding — செலுத்தப்படாத தொகை; ஆரஞ்சு நிறத்தில் எச்சரிக்கையாகக் காட்டப்படும்.',
      'Active Deliveries — திறந்த டெலிவரி பதிவுகளின் எண்ணிக்கை.',
      'மாதாந்திர வருவாய் வரைபடம் — ஒவ்வொரு மாதத்தின் விலைப்பட்டியல் மொத்தம்.',
      'சமீபத்திய விலைப்பட்டியல்கள் — கடைசி விலைப்பட்டியல்களுக்கான விரைவு இணைப்புகள்.',
    ],
  },

  quotations: {
    nav: 'மேற்கோள்கள்',
    title: 'மேற்கோள்கள் (Quotations)',
    desc: 'வேலை தொடங்குவதற்கு முன் வாடிக்கையாளர்களுக்கு விலை மேற்கோள் அனுப்பவும். வாடிக்கையாளர் ஒப்புக்கொண்டால் மேற்கோளை விலைப்பட்டியலாக மாற்றலாம்.',
    steps: [
      'Quotations → "+ New Quotation" என்பதை கிளிக் செய்யவும்.',
      'வாடிக்கையாளர் தேர்வு செய்து தேதி மற்றும் "Valid Until" தேதி உள்ளிடவும்.',
      '"+Service" — கட்டண அடிப்படையிலான சேவை; "+Delivery" — டெலிவரி பயணங்களுக்கு.',
      'சேவை உருப்படி: விளக்கம், தொடக்க தேதி, இறுதி தேதி, கட்டணம் (நாள் அல்லது வாரம்) உள்ளிடவும்.',
      'டெலிவரி உருப்படி: விளக்கம் மற்றும் யூனிட் விலை உள்ளிட்டு, ஒவ்வொரு தேதியையும் "+ Add" மூலம் சேர்க்கவும் — அளவு தானாக புதுப்பிக்கப்படும்.',
      'விளக்கம் தட்டச்சு செய்யும்போது Item Catalog பரிந்துரைகள் தோன்றும் — கிளிக் செய்தால் விலையும் நிரப்பப்படும்.',
      'தேதிகள் கட்டாயம் — சேவைக்கு From/To தேதிகள், டெலிவரிக்கு குறைந்தது ஒரு தேதி.',
      'Save கிளிக் செய்யவும். மேற்கோளுக்கு தனித்துவமான எண் வழங்கப்படும் (எ.கா. QUO-0001) — Settings-இல் prefix மற்றும் தொடக்க எண்ணை மாற்றலாம், அல்லது ஒவ்வொரு வாடிக்கையாளருக்கும் தனியாக அமைக்கலாம்.',
      '"View PDF" கிளிக் செய்யவும் — உலாவியில் PDF திறக்கும்; அங்கிருந்து அச்சிடலாம் அல்லது சேமிக்கலாம்.',
      '"Send Email" கிளிக் செய்யவும் — வாடிக்கையாளரின் மின்னஞ்சலுக்கு PDF அனுப்பப்படும் (வாடிக்கையாளருக்கு மின்னஞ்சல் இருக்க வேண்டும்).',
      'வாடிக்கையாளருக்கு மின்னஞ்சல் இல்லையெனில், அல்லது நிலையை நேரடியாக மாற்ற விரும்பினால்: "Mark as Sent", "Mark as Accepted", அல்லது "Mark as Rejected" பயன்படுத்தவும்.',
      'அனுப்பப்பட்ட அல்லது ஒப்புக்கொள்ளப்பட்ட மேற்கோளில் "Convert to Invoice" கிளிக் செய்யவும் — வாடிக்கையாளர் மற்றும் உருப்படிகள் தானாக நிரப்பப்பட்டு, மேற்கோள் "converted" ஆக குறிக்கப்படும்.',
    ],
  },

  invoices: {
    nav: 'விலைப்பட்டியல்கள்',
    title: 'விலைப்பட்டியல்கள் (Invoices)',
    desc: 'அனைத்து விலைப்பட்டியல்களையும் நிர்வகிக்கவும். கட்டண நிலையை கண்காணிக்கவும், PDF பார்க்கவும், மின்னஞ்சல் அனுப்பவும்.',
    steps: [
      'Invoices என்பதற்கு செல்லவும் — நிலை குறியீடுகளுடன் (Draft, Sent, Paid, Overdue) பட்டியல் காட்டப்படும்.',
      'விவரங்கள் காண விலைப்பட்டியல் எண்ணை கிளிக் செய்யவும்.',
      '"View PDF" — உலாவியில் PDF திறக்கும்; அங்கிருந்து அச்சிடலாம் அல்லது பதிவிறக்கலாம்.',
      '"Send Email" — வாடிக்கையாளரின் மின்னஞ்சலுக்கு விலைப்பட்டியல் அனுப்பவும்.',
      '"Record Payment" — முழு அல்லது பகுதி தொகை செலுத்தியதாக பதிவு செய்யவும். நிலுவை தொகை தானாக புதுப்பிக்கப்படும்.',
      'முழுத் தொகையும் பதிவானதும் நிலை "Paid" ஆகும்; PDF-ல் "PAID IN FULL" காட்டப்படும்.',
      'நேரடியாகவும் உருவாக்கலாம்: Invoices → "+ New Invoice".',
      'New Invoice பக்கத்தில் "Load from Quotation" (விரும்பினால்) — ஏற்கனவே உள்ள மேற்கோளை தேர்வு செய்து வாடிக்கையாளர் மற்றும் உருப்படிகளை தானாக நிரப்பலாம்; சேமிக்கும் முன் அனைத்தையும் திருத்தலாம். இது அந்த மேற்கோளை "converted" ஆக குறிக்கும் — மீண்டும் ஏற்ற முடியாது.',
      'டெலிவரி வரிகளில் பல தேதிகள் சேர்க்கலாம் — ஒவ்வொரு தேதியும் chip ஆக காட்டப்படும்; PDF-ல் ஒவ்வொரு தேதியும் தனி வரியாக அச்சிடப்படும்.',
    ],
  },

  clients: {
    nav: 'வாடிக்கையாளர்கள்',
    title: 'வாடிக்கையாளர்கள் (Clients)',
    desc: 'வாடிக்கையாளர் நிறுவனங்களை நிர்வகிக்கவும். ஒவ்வொரு வாடிக்கையாளருக்கும் தனித்துவமான குறியீடு மேற்கோள் மற்றும் விலைப்பட்டியல் எண்களில் பயன்படுகிறது.',
    steps: [
      'Clients → "+ New Client" கிளிக் செய்யவும்.',
      'நிறுவனத்தின் பெயர், குறியீடு (எ.கா. SMM), தொடர்பு நபர், மின்னஞ்சல், தொலைபேசி, முகவரி உள்ளிடவும்.',
      'விரும்பினால், இந்த வாடிக்கையாளருக்கு மட்டும் தனி invoice/quotation prefix மற்றும் தொடக்க எண் அமைக்கலாம் — இல்லையெனில் Settings-இல் உள்ள global prefix பயன்படுத்தப்படும்.',
      'புதுப்பிக்க திருத்த ஐகானை கிளிக் செய்யவும்.',
      'தேடல் பட்டியில் பெயர் அல்லது குறியீட்டால் தேடவும்.',
    ],
  },

  jobs: {
    nav: 'வேலைகள்',
    title: 'வேலைகள் (Jobs)',
    desc: 'போக்குவரத்து வேலைகளை உருவாக்கி டிரைவர்களுக்கு ஒதுக்கவும். டிரைவர்கள் தங்கள் வேலை பட்டியலை பார்க்கலாம்.',
    steps: [
      'Jobs → "+ New Job" கிளிக் செய்யவும்.',
      'வாடிக்கையாளர், டிரைவர், ஏற்றுமதி/இறக்குமதி இடம், தேதி தேர்வு செய்யவும்.',
      'வேலை விளக்கம் மற்றும் குறிப்புகள் சேர்க்கவும்.',
      'Save கிளிக் செய்யவும். டிரைவர் "My Jobs" பார்வையில் இதை காண்பார்.',
      'வேலை திறந்து டிரைவரின் நிலை புதுப்பிப்புகள் காணவும் (In Progress, Completed).',
      'நிர்வாகி/பணியாளர் வேலை விவர பக்கத்தில் இருந்து புதுப்பிக்கலாம்.',
    ],
  },

  delivery: {
    nav: 'டெலிவரி பதிவு',
    title: 'டெலிவரி பதிவு (Delivery Log)',
    desc: 'தனிப்பட்ட டெலிவரி பயணங்களை பொருட்கள் விவரம், அளவு மற்றும் விலையுடன் பதிவு செய்யவும். பல டெலிவரிகளை ஒரே விலைப்பட்டியலாக மாற்ற "Generate Invoice" பயன்படுத்தவும்.',
    steps: [
      'Delivery Log → "+ New Delivery" கிளிக் செய்யவும்.',
      'வாடிக்கையாளர், டிரைவர், வாகனம் தேர்வு செய்து டெலிவரி தேதி உள்ளிடவும்.',
      'உருப்படிகள் சேர்க்கவும்: விளக்கம் (catalog-இல் இருந்து அல்லது தட்டச்சு), அளவு, யூனிட் விலை.',
      'Save கிளிக் செய்யவும். டெலிவரி "pending" நிலையில் பட்டியலில் தோன்றும்.',
      'பல டெலிவரிகளுக்கு விலைப்பட்டியல் உருவாக்க: checkbox கிளிக் செய்யவும் → "Generate Invoice".',
      'தொகுக்கப்பட்ட உருப்படிகள் பரிசீலித்து "Create Invoice" கிளிக் செய்யவும் — டெலிவரிகள் "invoiced" ஆகும்.',
      '"View PDF" கிளிக் செய்யவும் — உலாவியில் PDF திறக்கும்; அங்கிருந்து அச்சிடலாம் அல்லது சேமிக்கலாம்.',
    ],
  },

  drivers: {
    nav: 'டிரைவர்கள்',
    title: 'டிரைவர்கள் (Drivers)',
    desc: 'டிரைவர்களை சேர்த்து உரிமம் விவரங்கள் நிர்வகிக்கவும். டிரைவர் சேர்க்கும்போது தானாக உள்நுழைவு கணக்கு உருவாகும்.',
    steps: [
      'Drivers → "+ Add Driver" கிளிக் செய்யவும்.',
      'பெயர், மின்னஞ்சல், தொலைபேசி, கடவுச்சொல் உள்ளிடவும் — இவை உள்நுழைவு சான்றுகள்.',
      'விரும்பினால் உரிம எண், உரிம காலாவதி தேதி, ஒதுக்கப்பட்ட வாகனம் அமைக்கவும்.',
      'Save கிளிக் செய்யவும். டிரைவர் இப்போது உள்நுழைந்து ஒதுக்கப்பட்ட வேலைகள் காணலாம்.',
      'திருத்த ஐகான் கிளிக் செய்து விவரங்கள் புதுப்பிக்கவும்.',
      'Active சுவிட்ச் அணைத்தால் டிரைவர் உள்நுழைய முடியாது.',
      'டிரைவர் கணக்குகளை Users பக்கத்தில் உருவாக்க முடியாது — Drivers பக்கத்தில் மட்டுமே.',
    ],
  },

  fleet: {
    nav: 'வாகனங்கள்',
    title: 'வாகனங்கள் / Fleet',
    desc: 'அனைத்து வாகனங்களையும் பதிவு செய்யவும். வாகனங்கள் டிரைவர்கள் மற்றும் டெலிவரி பதிவுகளுடன் இணைக்கப்படுகின்றன.',
    steps: [
      'Fleet → "+ Add Vehicle" கிளிக் செய்யவும்.',
      'பதிவு எண், வாகன வகை (Truck / Van / Lorry), அளவு, குறிப்புகள் உள்ளிடவும்.',
      'Save கிளிக் செய்யவும். இப்போது டிரைவர் மற்றும் டெலிவரிகளில் இந்த வாகனத்தை ஒதுக்கலாம்.',
      'திருத்த ஐகான் கிளிக் செய்து பதிவு எண் அல்லது வகை புதுப்பிக்கவும்.',
    ],
  },

  reports: {
    nav: 'அறிக்கைகள்',
    title: 'அறிக்கைகள் (Reports)',
    desc: 'நிதி சுருக்கங்கள் காண்க — காலகட்ட வருவாய், வாடிக்கையாளர் பிரிவு, மற்றும் நிலுவை விலைப்பட்டியல்கள்.',
    steps: [
      'Reports செல்லவும். தேதி வரம்பு தேர்வு செய்யவும் (Month / Quarter / Year அல்லது தனிப்பயன்).',
      'Revenue Summary — மொத்த விலைப்பட்டியல் தொகை, வசூலிக்கப்பட்ட தொகை, நிலுவை.',
      'Client Breakdown — தேர்ந்த காலகட்டத்தில் வாடிக்கையாளர்வாரியான மொத்தங்கள்.',
      'Outstanding Invoices — காலக்கெடு தேதி வரிசையில் செலுத்தப்படாத விலைப்பட்டியல்கள்.',
      'Export பொத்தானை கிளிக் செய்து அறிக்கையை CSV ஆக பதிவிறக்கவும்.',
    ],
  },

  users: {
    nav: 'பயனர்கள்',
    title: 'பயனர்கள் (Users)',
    desc: 'நிர்வாகி மற்றும் பணியாளர் கணக்குகளை நிர்வகிக்கவும். இந்த பக்கம் Admin மட்டுமே அணுகலாம். டிரைவர் கணக்குகள் Drivers பக்கத்தில் தனியாக நிர்வகிக்கப்படும்.',
    steps: [
      'Users → "+ New User" கிளிக் செய்யவும்.',
      'பெயர், மின்னஞ்சல், தொலைபேசி, கடவுச்சொல் உள்ளிட்டு பங்கு (Admin அல்லது Staff) தேர்வு செய்யவும்.',
      'Admin: அனைத்து பக்கங்களுக்கும் முழு அணுகல் (Users, Settings, Item Catalog உட்பட).',
      'Staff: மேற்கோள்கள், விலைப்பட்டியல்கள், வாடிக்கையாளர்கள், வேலைகள், டெலிவரிகள் — ஆனால் பயனர்கள் அல்லது அமைப்புகள் இல்லை.',
      'திருத்த ஐகான் கிளிக் செய்து பெயர், மின்னஞ்சல் அல்லது பங்கு புதுப்பிக்கவும்.',
      'Active சுவிட்ச் அணைத்தால் கணக்கு செயலிழக்கும்.',
    ],
  },

  catalog: {
    nav: 'சேவை பட்டியல்',
    title: 'சேவை பட்டியல் (Item Catalog)',
    desc: 'பொதுவான சேவை விளக்கங்களின் நூலகம். மேற்கோள்கள், விலைப்பட்டியல்கள் அல்லது டெலிவரிகளில் உருப்படிகள் சேர்க்கும்போது இந்த பட்டியலில் இருந்து தேடி நிரப்பலாம்.',
    steps: [
      'Item Catalog → "+ New Item" கிளிக் செய்யவும்.',
      'விளக்கம் உள்ளிடவும் (எ.கா. "Transportation of machinery from Port to Factory").',
      'விரும்பினால் இயல்புநிலை யூனிட் விலை அமைக்கவும்.',
      'Save கிளிக் செய்யவும். இப்போது எந்த படிவத்திலும் இந்த உருப்படியை தேடலாம்.',
      'படிவத்தில் விளக்கம் தட்டச்சு செய்யும்போது — பொருந்தும் catalog உருப்படிகள் பரிந்துரைகளாக தோன்றும்.',
      'பரிந்துரை கிளிக் செய்தால் விளக்கம் (மற்றும் விலை இருந்தால்) தானாக நிரப்பப்படும்.',
    ],
  },

  settings: {
    nav: 'அமைப்புகள்',
    title: 'அமைப்புகள் (Settings)',
    desc: 'நிறுவனத் தகவல், பிராண்டிங் மற்றும் இயல்புநிலை கட்டண விதிமுறைகளை உள்ளமைக்கவும். இந்த தகவல் அனைத்து PDF மற்றும் உலாவி tab-இலும் தோன்றும்.',
    steps: [
      'Settings → நிறுவனத்தின் பெயர், பதிவு எண், முகவரி, தொலைபேசி, மின்னஞ்சல் உள்ளிடவும்.',
      'Company Logo: "Upload Logo" கிளிக் செய்து நிறுவன லோகோ படம் பதிவேற்றவும் (PNG/JPG). அனைத்து PDF-களிலும், ஆவண முன்னோட்டங்களிலும், மற்றும் உலாவி தலைப்பிலும் காட்டப்படும்.',
      'Logo Initials: லோகோ படம் இல்லாதபோது பக்கப்பட்டி badge-ல் காட்டப்படும் 3 எழுத்துகள்.',
      'நாணய சின்னம் (இயல்பு S$) மற்றும் நாணய குறியீடு (இயல்பு SGD) அமைக்கவும்.',
      'Payment Terms Days — PDF-இல் விதிமுறைகள் பகுதியில் பயன்படுகிறது.',
      'Signatory Name — PDF ஆவணங்களில் அங்கீகரிக்கப்பட்ட கையொப்பத்தாரர் பெயர்.',
      'Seal & Signature: நிறுவன முத்திரை படம் மற்றும் கையொப்ப படம் பதிவேற்றவும். இவை ஒவ்வொரு PDF-லும் கையொப்ப வரிக்கு மேலே காட்டப்படும்.',
      'Test Mode (super admin / நியமிக்கப்பட்ட test கணக்கு மட்டும்): உண்மையான தரவை பாதிக்காமல் invoice/quotation/client உருவாக்குவதை பரிசோதிக்க இதை இயக்கவும். இயக்கும்போது "TEST MODE ACTIVE" பேனர் எங்கும் தோன்றும், புதிய பதிவுகள் தனி எண் வரிசையுடன் (எ.கா. TEST-INV-0001) dummy தரவாக குறிக்கப்படும், மற்றும் அணைக்கும் வரை அந்த dummy தரவு மட்டுமே காட்டப்படும் — உண்மையான தரவு மறைக்கப்படும், அழிக்கப்படாது. Reports மற்றும் வருவாய் புள்ளிவிவரங்கள் எப்போதும் உண்மையான தரவை மட்டுமே காட்டும்.',
      '"Save Changes" கிளிக் செய்து அனைத்து மாற்றங்களும் உடனடியாக சேமிக்கவும்.',
    ],
  },

  workflowSteps: [
    { icon: 'business', label: 'வாடிக்கையாளர் சேர்க்கவும்', desc: 'தொடர்பு விவரங்களுடன் வாடிக்கையாளர் நிறுவன பதிவு உருவாக்கவும்.' },
    { icon: 'description', label: 'மேற்கோள் உருவாக்கவும்', desc: 'வரிசை உருப்படிகளுடன் விலை மேற்கோள் கட்டி வாடிக்கையாளருக்கு PDF அனுப்பவும்.' },
    { icon: 'check_circle', label: 'வாடிக்கையாளர் ஒப்புக்கொள்கிறார்', desc: 'ஒப்புக்கொண்ட மேற்கோளில் "Convert to Invoice" கிளிக் செய்யவும்.' },
    { icon: 'receipt_long', label: 'விலைப்பட்டியல் அனுப்பப்படுகிறது', desc: 'PDF மின்னஞ்சல் செய்து கட்டண நிலையை கண்காணிக்கவும்.' },
    { icon: 'payments', label: 'கட்டணம் பதிவு செய்யவும்', desc: 'கட்டணம் பதிவு செய்யவும் — விலைப்பட்டியல் நிலை "Paid" ஆகும்.' },
  ],
};

const sectionImages = {
  dashboard: '/guide/dashboard.jpg',
  quotations: '/guide/quotations.jpg',
  invoices: '/guide/invoices.jpg',
  clients: '/guide/clients.jpg',
  jobs: '/guide/jobs.jpg',
  delivery: '/guide/delivery-log.jpg',
  drivers: '/guide/drivers.jpg',
  fleet: '/guide/vehicles.jpg',
  reports: '/guide/reports.jpg',
  users: '/guide/users.jpg',
  catalog: '/guide/item-catalog.jpg',
  settings: '/guide/settings.jpg',
};

const sectionData = computed(() => t.value);

function scrollTo(id) {
  activeSection.value = id;
  const el = document.getElementById(`section-${id}`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
</script>

<template>
  <div class="flex h-full overflow-hidden bg-gray-50 dark:bg-slate-900">

    <!-- Left TOC -->
    <aside class="w-52 shrink-0 border-r border-gray-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 overflow-y-auto py-4">
      <div class="px-4 mb-3">
        <div class="text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest">{{ t.toc }}</div>
      </div>
      <nav class="space-y-0.5 px-2">
        <button
          v-for="id in sections"
          :key="id"
          @click="scrollTo(id)"
          class="w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors"
          :class="activeSection === id
            ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400 font-medium'
            : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'"
        >
          {{ t[id]?.nav }}
        </button>
      </nav>
    </aside>

    <!-- Main content -->
    <main class="flex-1 overflow-y-auto">

      <!-- Header -->
      <div class="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700/60 px-8 py-4 flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-gray-900 dark:text-slate-100">{{ t.title }}</h1>
          <p class="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{{ t.subtitle }}</p>
        </div>
        <button
          @click="toggle"
          class="flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-600/40 bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400 text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-600/30 transition-colors"
        >
          <span class="material-icons" style="font-size:16px">translate</span>
          {{ t.langBtn }}
        </button>
      </div>

      <div class="px-8 py-8 max-w-4xl mx-auto space-y-16">

        <!-- Workflow -->
        <section :id="`section-workflow`">
          <h2 class="text-lg font-bold text-gray-900 dark:text-slate-100 mb-6 flex items-center gap-2">
            <span class="material-icons text-blue-600" style="font-size:20px">route</span>
            {{ t.workflow }}
          </h2>
          <div class="flex items-start gap-0">
            <div
              v-for="(step, i) in t.workflowSteps"
              :key="i"
              class="flex-1 flex flex-col items-center text-center relative"
            >
              <div class="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-600/20 flex items-center justify-center mb-2 z-10 relative">
                <span class="material-icons text-blue-600 dark:text-blue-400" style="font-size:22px">{{ step.icon }}</span>
              </div>
              <!-- connector line -->
              <div v-if="i < t.workflowSteps.length - 1" class="absolute top-6 left-1/2 w-full h-0.5 bg-blue-200 dark:bg-blue-600/30 z-0"></div>
              <div class="text-xs font-semibold text-gray-800 dark:text-slate-200 mt-1 px-1 leading-tight">{{ step.label }}</div>
              <div class="text-[11px] text-gray-500 dark:text-slate-400 mt-1 px-2 leading-relaxed">{{ step.desc }}</div>
            </div>
          </div>
        </section>

        <!-- Module sections -->
        <section
          v-for="id in sections"
          :key="id"
          :id="`section-${id}`"
          class="scroll-mt-20"
        >
          <div class="flex items-start gap-3 mb-4">
            <div class="mt-0.5 w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <span class="material-icons text-white" style="font-size:16px">
                {{ {dashboard:'dashboard',quotations:'description',invoices:'receipt_long',clients:'business',jobs:'local_shipping',delivery:'inventory_2',drivers:'badge',fleet:'directions_car',reports:'bar_chart',users:'group',catalog:'category',settings:'settings'}[id] }}
              </span>
            </div>
            <div>
              <h2 class="text-lg font-bold text-gray-900 dark:text-slate-100">{{ t[id]?.title }}</h2>
              <p class="text-sm text-gray-600 dark:text-slate-400 mt-1 leading-relaxed">{{ t[id]?.desc }}</p>
            </div>
          </div>

          <!-- Screenshot -->
          <div v-if="sectionImages[id]" class="rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700 shadow-md mb-5">
            <img :src="sectionImages[id]" :alt="t[id]?.title" class="w-full block" loading="lazy" />
          </div>

          <!-- Steps -->
          <ol class="space-y-2">
            <li
              v-for="(step, i) in t[id]?.steps"
              :key="i"
              class="flex gap-3 items-start"
            >
              <span class="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">{{ i + 1 }}</span>
              <span class="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">{{ step }}</span>
            </li>
          </ol>

          <div class="mt-6 border-b border-gray-100 dark:border-slate-800"></div>
        </section>

        <!-- Footer -->
        <div class="text-center py-8 text-sm text-gray-400 dark:text-slate-500">
          AKB Transport & Logistics &mdash; {{ lang === 'en' ? 'User Guide' : 'பயனர் வழிகாட்டி' }}
        </div>

      </div>
    </main>
  </div>
</template>
