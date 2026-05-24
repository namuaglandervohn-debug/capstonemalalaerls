import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  MenuItem,
  Container,
  Alert,
  Dialog,
  DialogContent,
  DialogActions,
  Grid,
  CircularProgress,
  Stack,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Chip,
} from '@mui/material';

import {
  Send,
  ContentCopy,
  Add,
  Delete,
  UploadFile,
  ArrowBackRounded,
  ArrowForwardRounded,
  WorkOutline,
  PersonOutline,
  SchoolOutlined,
  AutoAwesomeOutlined,
  Groups2Outlined,
  DescriptionOutlined,
  HomeWorkOutlined,
  AssignmentTurnedInOutlined,
  VerifiedUserOutlined,
  CheckCircleOutlineRounded,
  LocationOnOutlined,
  ArticleOutlined,
  FavoriteBorderRounded,
} from '@mui/icons-material';

import AuthBackground from '../AuthBackground';
import { copyToClipboard } from '../../lib/copyToClipboard';
import { saveApplicationFiles } from '../../lib/localDb';
import { supabase } from '../../lib/supabaseClient';

const CIVIL_STATUS = ['Single', 'Married', 'Widowed', 'Separated'];
const GENDER = ['Male', 'Female', 'Prefer not to say'];
const SUFFIXES = ['', 'Jr.', 'Sr.', 'II', 'III', 'IV'];

const EDUCATIONAL_ATTAINMENT = [
  'Elementary',
  'Junior High School',
  'Senior High School',
  'College / Vocational',
  'Postgraduate',
];

const HEAR_ABOUT_OPTIONS = ['Facebook', 'Referral', 'Walk-in', 'Job Posting', 'Other'];

const COUNTRIES = [
  'Philippines', 'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Argentina', 'Armenia',
  'Australia', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus',
  'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Brazil', 'Brunei',
  'Bulgaria', 'Cambodia', 'Cameroon', 'Canada', 'Chile', 'China', 'Colombia', 'Costa Rica',
  'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Denmark', 'Dominican Republic', 'Ecuador',
  'Egypt', 'Estonia', 'Ethiopia', 'Finland', 'France', 'Georgia', 'Germany', 'Ghana', 'Greece',
  'Guatemala', 'Honduras', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland',
  'Israel', 'Italy', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kuwait', 'Laos', 'Latvia',
  'Lebanon', 'Libya', 'Lithuania', 'Malaysia', 'Mexico', 'Mongolia', 'Morocco', 'Myanmar', 'Nepal',
  'New Zealand', 'Nigeria', 'Norway', 'Oman', 'Pakistan', 'Palestine', 'Panama', 'Paraguay', 'Peru',
  'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia', 'Saudi Arabia', 'Singapore', 'South Africa',
  'South Korea', 'Spain', 'Sri Lanka', 'Sweden', 'Switzerland', 'Taiwan', 'Thailand', 'Turkey',
  'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Venezuela', 'Vietnam',
];

const NATIONALITIES = [
  'Filipino', 'Afghan', 'Albanian', 'Algerian', 'American', 'Andorran', 'Angolan', 'Argentinian',
  'Armenian', 'Australian', 'Austrian', 'Azerbaijani', 'Bahamian', 'Bahraini', 'Bangladeshi',
  'Barbadian', 'Belarusian', 'Belgian', 'Belizean', 'Beninese', 'Bhutanese', 'Bolivian', 'Bosnian',
  'Brazilian', 'British', 'Bruneian', 'Bulgarian', 'Cambodian', 'Cameroonian', 'Canadian', 'Chilean',
  'Chinese', 'Colombian', 'Congolese', 'Costa Rican', 'Croatian', 'Cuban', 'Cypriot', 'Czech',
  'Danish', 'Dominican', 'Dutch', 'Ecuadorian', 'Egyptian', 'Emirati', 'Estonian', 'Ethiopian',
  'Finnish', 'French', 'Georgian', 'German', 'Ghanaian', 'Greek', 'Guatemalan', 'Honduran',
  'Hungarian', 'Icelandic', 'Indian', 'Indonesian', 'Iranian', 'Iraqi', 'Irish', 'Israeli', 'Italian',
  'Jamaican', 'Japanese', 'Jordanian', 'Kazakh', 'Kenyan', 'Korean', 'Kuwaiti', 'Laotian', 'Latvian',
  'Lebanese', 'Libyan', 'Lithuanian', 'Malaysian', 'Mexican', 'Mongolian', 'Moroccan', 'Myanmar',
  'Nepalese', 'New Zealander', 'Nigerian', 'Norwegian', 'Omani', 'Pakistani', 'Palestinian',
  'Panamanian', 'Paraguayan', 'Peruvian', 'Polish', 'Portuguese', 'Qatari', 'Romanian', 'Russian',
  'Saudi', 'Singaporean', 'South African', 'Spanish', 'Sri Lankan', 'Swedish', 'Swiss', 'Taiwanese',
  'Thai', 'Turkish', 'Ukrainian', 'Uruguayan', 'Venezuelan', 'Vietnamese',
];

const PH_PROVINCES_BY_REGION: Record<string, string[]> = {
  'National Capital Region (NCR)': ['Metro Manila'],
  'Cordillera Administrative Region (CAR)': ['Abra', 'Apayao', 'Benguet', 'Ifugao', 'Kalinga', 'Mountain Province'],
  'Region I - Ilocos Region': ['Ilocos Norte', 'Ilocos Sur', 'La Union', 'Pangasinan'],
  'Region II - Cagayan Valley': ['Batanes', 'Cagayan', 'Isabela', 'Nueva Vizcaya', 'Quirino'],
  'Region III - Central Luzon': ['Aurora', 'Bataan', 'Bulacan', 'Nueva Ecija', 'Pampanga', 'Tarlac', 'Zambales'],
  'Region IV-A - CALABARZON': ['Batangas', 'Cavite', 'Laguna', 'Quezon', 'Rizal'],
  'MIMAROPA Region': ['Marinduque', 'Occidental Mindoro', 'Oriental Mindoro', 'Palawan', 'Romblon'],
  'Region V - Bicol Region': ['Albay', 'Camarines Norte', 'Camarines Sur', 'Catanduanes', 'Masbate', 'Sorsogon'],
  'Region VI - Western Visayas': ['Aklan', 'Antique', 'Capiz', 'Guimaras', 'Iloilo', 'Negros Occidental'],
  'Region VII - Central Visayas': ['Bohol', 'Cebu', 'Negros Oriental', 'Siquijor'],
  'Region VIII - Eastern Visayas': ['Biliran', 'Eastern Samar', 'Leyte', 'Northern Samar', 'Samar', 'Southern Leyte'],
  'Region IX - Zamboanga Peninsula': ['Zamboanga del Norte', 'Zamboanga del Sur', 'Zamboanga Sibugay'],
  'Region X - Northern Mindanao': ['Bukidnon', 'Camiguin', 'Lanao del Norte', 'Misamis Occidental', 'Misamis Oriental'],
  'Region XI - Davao Region': ['Davao de Oro', 'Davao del Norte', 'Davao del Sur', 'Davao Occidental', 'Davao Oriental'],
  'Region XII - SOCCSKSARGEN': ['Cotabato', 'Sarangani', 'South Cotabato', 'Sultan Kudarat'],
  'Region XIII - Caraga': ['Agusan del Norte', 'Agusan del Sur', 'Dinagat Islands', 'Surigao del Norte', 'Surigao del Sur'],
  'Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)': ['Basilan', 'Lanao del Sur', 'Maguindanao del Norte', 'Maguindanao del Sur', 'Sulu', 'Tawi-Tawi'],
};

const CITIES_BY_PROVINCE: Record<string, string[]> = {
  'Metro Manila': ['Caloocan', 'Las Piñas', 'Makati', 'Malabon', 'Mandaluyong', 'Manila', 'Marikina', 'Muntinlupa', 'Navotas', 'Parañaque', 'Pasay', 'Pasig', 'Quezon City', 'San Juan', 'Taguig', 'Valenzuela', 'Pateros'],
  'Davao del Norte': ['Panabo City', 'Tagum City', 'Samal City', 'Asuncion', 'Braulio E. Dujali', 'Carmen', 'Kapalong', 'New Corella', 'San Isidro', 'Santo Tomas', 'Talaingod'],
  'Davao del Sur': ['Davao City', 'Digos City', 'Bansalan', 'Hagonoy', 'Kiblawan', 'Magsaysay', 'Malalag', 'Matanao', 'Padada', 'Santa Cruz', 'Sulop'],
  'Davao Oriental': ['Mati City', 'Baganga', 'Banaybanay', 'Boston', 'Caraga', 'Cateel', 'Governor Generoso', 'Lupon', 'Manay', 'San Isidro', 'Tarragona'],
  'Davao de Oro': ['Nabunturan', 'Monkayo', 'Mawab', 'Maco', 'Maragusan', 'Laak', 'Compostela', 'Montevista', 'New Bataan', 'Pantukan'],
  'Davao Occidental': ['Malita', 'Don Marcelino', 'Jose Abad Santos', 'Santa Maria', 'Sarangani'],
  'Cotabato': ['Kidapawan City', 'Alamada', 'Aleosan', 'Antipas', 'Arakan', 'Banisilan', 'Carmen', 'Kabacan', 'Libungan', 'Matalam', 'Midsayap', 'Pigcawayan', 'Pikit', 'President Roxas', 'Tulunan'],
  'South Cotabato': ['Koronadal City', 'General Santos City', 'Polomolok', 'Tupi', 'Tampakan', 'Surallah', 'Tboli', 'Lake Sebu', 'Norala', 'Banga', 'Sto. Niño'],
  'Sarangani': ['Alabel', 'Glan', 'Kiamba', 'Maasim', 'Maitum', 'Malapatan', 'Malungon'],
  'Sultan Kudarat': ['Isulan', 'Tacurong City', 'Bagumbayan', 'Columbio', 'Esperanza', 'Kalamansig', 'Lambayong', 'Lebak', 'Lutayan', 'Palimbang', 'President Quirino', 'Senator Ninoy Aquino'],
  'Cebu': ['Cebu City', 'Mandaue City', 'Lapu-Lapu City', 'Talisay City', 'Danao City', 'Toledo City', 'Carcar City', 'Naga City'],
  'Iloilo': ['Iloilo City', 'Passi City', 'Oton', 'Pavia', 'Santa Barbara', 'Miagao', 'Pototan'],
  'Cavite': ['Bacoor City', 'Cavite City', 'Dasmariñas City', 'General Trias City', 'Imus City', 'Tagaytay City', 'Trece Martires City'],
  'Laguna': ['Calamba City', 'San Pablo City', 'Santa Rosa City', 'Biñan City', 'Cabuyao City', 'Los Baños', 'Pagsanjan'],
  'Batangas': ['Batangas City', 'Lipa City', 'Tanauan City', 'Santo Tomas City', 'Nasugbu', 'Lemery'],
  'Pampanga': ['Angeles City', 'San Fernando City', 'Mabalacat City', 'Apalit', 'Guagua', 'Lubao', 'Mexico'],
  'Bulacan': ['Malolos City', 'Meycauayan City', 'San Jose del Monte City', 'Baliuag', 'Bocaue', 'Marilao', 'Plaridel'],
};

const ZIP_BY_CITY: Record<string, string> = {
  'Panabo City': '8105', 'Tagum City': '8100', 'Samal City': '8119', 'Davao City': '8000', 'Digos City': '8002', 'Mati City': '8200',
  'Nabunturan': '8800', 'Malita': '8012', 'Kidapawan City': '9400', 'Koronadal City': '9506', 'General Santos City': '9500',
  'Alabel': '9501', 'Isulan': '9805', 'Tacurong City': '9800', 'Cebu City': '6000', 'Mandaue City': '6014', 'Lapu-Lapu City': '6015',
  'Iloilo City': '5000', 'Bacoor City': '4102', 'Dasmariñas City': '4114', 'Imus City': '4103', 'Calamba City': '4027',
  'Santa Rosa City': '4026', 'Batangas City': '4200', 'Lipa City': '4217', 'Angeles City': '2009', 'San Fernando City': '2000',
  'Malolos City': '3000', 'Quezon City': '1100', 'Manila': '1000', 'Makati': '1200', 'Taguig': '1630', 'Pasig': '1600',
};

const BARANGAYS_BY_CITY: Record<string, string[]> = {
  'Panabo City': ['A.O. Floirendo', 'Buenavista', 'Cacao', 'Cagangohan', 'Consolacion', 'Dapco', 'Gredu', 'J.P. Laurel', 'Kasilak', 'Katipunan', 'Katualan', 'Kauswagan', 'Kiotoy', 'Little Panay', 'Lower Panaga', 'Mabunao', 'Maduao', 'Malativas', 'Manay', 'Nanyo', 'New Malaga', 'New Malitbog', 'New Pandan', 'New Visayas', 'Quezon', 'Salvacion', 'San Francisco', 'San Nicolas', 'San Pedro', 'San Roque', 'San Vicente', 'Santa Cruz', 'Santo Niño', 'Sindaton', 'Southern Davao', 'Tagpore', 'Tibungol', 'Upper Licanan', 'Waterfall'],
  'Davao City': ['Agdao', 'Baguio Proper', 'Buhangin', 'Calinan', 'Catalunan Grande', 'Matina Crossing', 'Mintal', 'Poblacion', 'Sasa', 'Talomo Proper', 'Toril'],
  'Tagum City': ['Apokon', 'Magugpo East', 'Magugpo North', 'Magugpo Poblacion', 'Magugpo South', 'Magugpo West', 'Mankilam', 'Visayan Village'],
  'Mati City': ['Central', 'Dahican', 'Don Enrique Lopez', 'Sainz', 'Tamisan'],
};

const RELATIONSHIPS = ['Parent', 'Mother', 'Father', 'Spouse', 'Sibling', 'Brother', 'Sister', 'Child', 'Relative', 'Guardian', 'Friend', 'Neighbor', 'Partner', 'Cousin', 'Aunt', 'Uncle', 'Grandparent', 'Other'];

const SKILLS = ['Communication Skills', 'Customer Service', 'Computer Literacy', 'Leadership', 'Time Management', 'Teamwork', 'Problem-Solving', 'Cash Handling', 'Food and Beverage Service', 'Housekeeping', 'Administrative Work'];

const REQUIRED_DOCUMENTS = ['Resume/Biodata', 'Application Letter', 'Valid ID', 'Birth Certificate', 'Transcript of Records/Diploma', 'Certificate of Employment', 'Training Certificates', 'NBI/Police Clearance', 'Barangay Clearance', 'Medical Certificate'];

const steps = ['Position', 'Personal', 'Education & Work', 'Skills', 'References', 'Documents'];

type CharacterReference = { name: string; position: string; company: string; contact: string };

const EMPTY = {
  position: '', hearAbout: '', hearAboutOther: '',
  firstName: '', middleName: '', lastName: '', suffix: '', birthdate: '', age: '', gender: '', civilStatus: '', nationality: '', contactNumber: '', email: '',
  currentCountry: 'Philippines', currentRegion: '', currentProvince: '', currentCity: '', currentBarangay: '', currentStreet: '', currentZipCode: '', currentAddress: '',
  permanentCountry: 'Philippines', permanentRegion: '', permanentProvince: '', permanentCity: '', permanentBarangay: '', permanentStreet: '', permanentZipCode: '', permanentAddress: '',
  emergencyContactName: '', emergencyContactRelation: '', emergencyContactRelationOther: '', emergencyContactPhone: '', emergencyContactAddress: '',
  education: '', schoolName: '', courseProgram: '', yearGraduated: '', honorsAwards: '',
  companyOrganization: '', positionHeld: '', employmentStartDate: '', employmentEndDate: '', employmentPeriod: '', dutiesResponsibilities: '', reasonForLeaving: '', totalYearsExperience: '', previousSupervisor: '', supervisorContact: '',
  skills: [] as string[], otherSkills: '', certification1: '', certification2: '', certification3: '',
  referenceName: '', referencePosition: '', referenceCompany: '', referenceContact: '',
  submittedDocuments: [] as string[], otherDocument: '', applicantSignature: '', declarationDate: '',
  birthplace: '', height: '', weight: '', address: '', experience: '', tin: '', sss: '', philhealth: '', pagibig: '',
};

type FormState = typeof EMPTY;
type FormKey = keyof FormState;
type FieldErrors = Partial<Record<FormKey | 'resumeFiles', string>>;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function calculateAge(birthdate: string) {
  if (!birthdate) return '';
  const birth = new Date(birthdate);
  const today = new Date();
  if (Number.isNaN(birth.getTime()) || birth > today) return '';
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age >= 0 ? String(age) : '';
}

const fallbackBarangays = ['Poblacion', 'Barangay 1', 'Barangay 2', 'Barangay 3', 'Other / Not listed'];

const SectionTitle = ({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
}) => (
  <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 3 }}>
    <Box
      sx={{
        width: 42,
        height: 42,
        minWidth: 42,
        borderRadius: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#166534',
        background: 'linear-gradient(135deg, rgba(220, 252, 231, 0.96), rgba(187, 247, 208, 0.68))',
        border: '1px solid rgba(34, 197, 94, 0.18)',
        boxShadow: '0 12px 26px rgba(22, 101, 52, 0.10)',
      }}
    >
      {icon}
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography
        variant="h6"
        fontWeight={900}
        sx={{ color: '#14532d', lineHeight: 1.15, letterSpacing: '-0.02em', overflowWrap: 'anywhere' }}
      >
        {title}
      </Typography>
      {description && (
        <Typography color="text.secondary" sx={{ mt: 0.5, fontSize: { xs: '0.88rem', sm: '0.95rem' }, overflowWrap: 'anywhere' }}>
          {description}
        </Typography>
      )}
    </Box>
  </Stack>
);

export default function ApplyForJobPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedPosition = (searchParams.get('position') ?? '').trim();

  const [formData, setFormData] = useState<FormState>(EMPTY);
  const [openPositions, setOpenPositions] = useState<string[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [resumeFiles, setResumeFiles] = useState<File[]>([]);
  const [supportingFiles, setSupportingFiles] = useState<File[]>([]);
  const [successDialog, setSuccessDialog] = useState(false);
  const [applicantId, setApplicantId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [characterReferences, setCharacterReferences] = useState<CharacterReference[]>([{ name: '', position: '', company: '', contact: '' }]);

  const textFieldSx = {
    '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 800, letterSpacing: '-0.01em' },
    '& .MuiInputLabel-root.Mui-focused': { color: '#166534' },
    '& .MuiOutlinedInput-root': {
      borderRadius: '16px',
      backgroundColor: '#fbfefc',
      transition: 'all 0.25s ease',
      boxShadow: '0 6px 16px rgba(15, 23, 42, 0.025)',
      '& input': { padding: { xs: '14px 14px', sm: '16px 15px' }, fontSize: { xs: '0.9rem', sm: '0.95rem' }, fontWeight: 700, color: '#1f2937' },
      '& textarea': { padding: { xs: '14px 14px', sm: '16px 15px' }, fontSize: { xs: '0.9rem', sm: '0.95rem' }, fontWeight: 700, color: '#1f2937' },
      '& fieldset': { borderColor: 'rgba(22, 101, 52, 0.14)', borderWidth: '1px' },
      '&:hover': { backgroundColor: '#ffffff', boxShadow: '0 10px 24px rgba(15, 23, 42, 0.05)' },
      '&:hover fieldset': { borderColor: 'rgba(34, 197, 94, 0.46)' },
      '&.Mui-focused': { backgroundColor: '#ffffff', boxShadow: '0 0 0 5px rgba(34,197,94,0.10), 0 12px 28px rgba(15,23,42,0.06)' },
      '&.Mui-focused fieldset': { borderColor: '#22c55e', borderWidth: '1.5px' },
    },
    '& .MuiSelect-select': { fontSize: { xs: '0.9rem', sm: '0.95rem' }, fontWeight: 700, color: '#1f2937' },
    '& .MuiFormHelperText-root': {
      mx: { xs: 0.5, sm: 1.75 },
      overflowWrap: 'anywhere',
      fontWeight: 650,
    },
  };

  const softButtonSx = {
    textTransform: 'none',
    fontWeight: 900,
    borderRadius: '16px',
    minHeight: { xs: 46, sm: 52 },
    px: { xs: 2.5, sm: 4 },
    lineHeight: 1.25,
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
    textAlign: 'center',
    letterSpacing: '-0.01em',
    transition: 'all 0.25s ease',
    boxShadow: '0 12px 28px rgba(31,122,71,0.14)',
    '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 16px 34px rgba(31,122,71,0.20)' },
  };

  const stepPaperSx = {
    p: { xs: 2, sm: 2.5, md: 4 },
    mb: { xs: 2, md: 3 },
    borderRadius: '26px',
    border: '1px solid rgba(22,101,52,0.10)',
    background: 'linear-gradient(180deg, #ffffff 0%, #fbfefc 100%)',
    minHeight: { xs: 'auto', lg: 520 },
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    boxShadow: '0 18px 45px rgba(15,23,42,0.06)',
    width: '100%',
    overflow: 'hidden',
  };

  const nestedPaperSx = {
    p: { xs: 2, sm: 2.5 },
    borderRadius: '20px',
    border: '1px solid rgba(22,101,52,0.10)',
    background: 'linear-gradient(180deg, #fbfefc 0%, #f6fbf4 100%)',
    boxShadow: '0 14px 34px rgba(15,23,42,0.045)',
    overflow: 'hidden',
  };

  const fieldGrid = { xs: 12, sm: 6, lg: 4 };
  const nameGrid = { xs: 12, sm: 6, lg: 3 };
  const halfGrid = { xs: 12, md: 6 };
  const addressGrid = { xs: 12, sm: 6, lg: 3 };
  const fullOnMobileGrid = { xs: 12, md: 6, lg: 8 };
  const responsiveHeroTitleSx = {
    color: '#14532d',
    lineHeight: 1.05,
    fontSize: { xs: '1.85rem', sm: '2.35rem', md: '3rem' },
    overflowWrap: 'anywhere',
  };
  const responsiveFormTitleSx = {
    color: '#14532d',
    mb: 1,
    fontSize: { xs: '1.5rem', sm: '1.85rem', md: '2.125rem' },
    overflowWrap: 'anywhere',
  };
  const compactChoiceSx = {
    width: { xs: '100%', sm: '50%', lg: '32%' },
    mr: 0,
    '& .MuiFormControlLabel-label': {
      fontSize: { xs: '0.9rem', sm: '0.95rem' },
      overflowWrap: 'anywhere',
    },
  };
  const uploadButtonSx = {
    ...softButtonSx,
    borderColor: '#166534',
    color: '#166534',
    background: '#ffffff',
    minHeight: { xs: 76, sm: 90 },
    px: { xs: 2, sm: 3 },
    '& .MuiButton-startIcon': { flexShrink: 0 },
  };

  const stepIconSx = { fontSize: { xs: 18, sm: 20, md: 22 } };
  const stepIcons = [
    <WorkOutline sx={stepIconSx} />,
    <PersonOutline sx={stepIconSx} />,
    <SchoolOutlined sx={stepIconSx} />,
    <AutoAwesomeOutlined sx={stepIconSx} />,
    <Groups2Outlined sx={stepIconSx} />,
    <DescriptionOutlined sx={stepIconSx} />,
  ];

  const clearFieldError = (key: FormKey | 'resumeFiles') => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  useEffect(() => {
    let isMounted = true;

    const fetchOpenPositions = async () => {
      setPositionsLoading(true);

      const { data, error: positionsError } = await supabase
        .from('job_postings')
        .select('title, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (!isMounted) return;

      if (positionsError) {
        console.error(positionsError);
        setOpenPositions([]);
        setError('Unable to load open positions. Please refresh the page or try again later.');
      } else {
        const titles = Array.from(
          new Set(
            (data ?? [])
              .map((job) => String(job.title ?? '').trim())
              .filter(Boolean)
          )
        );

        setOpenPositions(titles);
      }

      setPositionsLoading(false);
    };

    fetchOpenPositions();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (positionsLoading) return;

    if (requestedPosition && openPositions.includes(requestedPosition)) {
      setFormData((prev) =>
        prev.position === requestedPosition ? prev : { ...prev, position: requestedPosition }
      );
      clearFieldError('position');
      return;
    }

    if (requestedPosition && !openPositions.includes(requestedPosition)) {
      setFormData((prev) => (prev.position ? { ...prev, position: '' } : prev));
      setFieldErrors((prev) => ({
        ...prev,
        position: 'The selected position is no longer available. Please choose from the current open positions.',
      }));
      return;
    }

    setFormData((prev) =>
      prev.position && !openPositions.includes(prev.position) ? { ...prev, position: '' } : prev
    );
  }, [positionsLoading, requestedPosition, openPositions]);

  const set = (key: FormKey) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [key]: e.target.value }));
    clearFieldError(key);
  };

  const setUpperText = (key: FormKey) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value.replace(/[^a-zA-ZÀ-žñÑ .'-]/g, '');
    setFormData((prev) => ({ ...prev, [key]: value }));
    clearFieldError(key);
  };

  const setNumeric = (key: FormKey, maxLength: number) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, maxLength);
    setFormData((prev) => ({ ...prev, [key]: value }));
    clearFieldError(key);
  };

  const setEmail = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, email: e.target.value.trim().toLowerCase() }));
    clearFieldError('email');
  };

  const setBirthdate = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, birthdate: value, age: calculateAge(value) }));
    clearFieldError('birthdate');
    clearFieldError('age');
  };

  const setPhone = (key: 'contactNumber' | 'emergencyContactPhone') => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 11);
    setFormData((prev) => ({ ...prev, [key]: value }));
    clearFieldError(key);
  };

  const buildAddress = (country: string, region: string, province: string, city: string, barangay: string, street: string, zipCode: string) =>
    [street, barangay, city, province, region, country, zipCode].map((part) => part.trim()).filter(Boolean).join(', ');

  const getProvinceOptions = (country: string, region: string) => country === 'Philippines' && region ? PH_PROVINCES_BY_REGION[region] ?? [] : [];
  const getCityOptions = (province: string) => CITIES_BY_PROVINCE[province] ?? [];
  const getBarangayOptions = (city: string) => BARANGAYS_BY_CITY[city] ?? fallbackBarangays;

  const handleAddressCountryChange = (prefix: 'current' | 'permanent', value: string) => {
    setFormData((prev) => ({
      ...prev,
      [`${prefix}Country`]: value,
      [`${prefix}Region`]: '',
      [`${prefix}Province`]: '',
      [`${prefix}City`]: '',
      [`${prefix}Barangay`]: '',
      [`${prefix}ZipCode`]: '',
    } as FormState));
  };

  const handleAddressRegionChange = (prefix: 'current' | 'permanent', value: string) => {
    setFormData((prev) => ({
      ...prev,
      [`${prefix}Region`]: value,
      [`${prefix}Province`]: '',
      [`${prefix}City`]: '',
      [`${prefix}Barangay`]: '',
      [`${prefix}ZipCode`]: '',
    } as FormState));
    clearFieldError(`${prefix}Region` as FormKey);
  };

  const handleAddressProvinceChange = (prefix: 'current' | 'permanent', value: string) => {
    setFormData((prev) => ({
      ...prev,
      [`${prefix}Province`]: value,
      [`${prefix}City`]: '',
      [`${prefix}Barangay`]: '',
      [`${prefix}ZipCode`]: '',
    } as FormState));
    clearFieldError(`${prefix}Province` as FormKey);
  };

  const handleAddressCityChange = (prefix: 'current' | 'permanent', value: string) => {
    setFormData((prev) => ({
      ...prev,
      [`${prefix}City`]: value,
      [`${prefix}Barangay`]: '',
      [`${prefix}ZipCode`]: ZIP_BY_CITY[value] ?? '',
    } as FormState));
    clearFieldError(`${prefix}City` as FormKey);
  };

  const handleAddressBarangayChange = (prefix: 'current' | 'permanent', value: string) => {
    setFormData((prev) => ({ ...prev, [`${prefix}Barangay`]: value } as FormState));
    clearFieldError(`${prefix}Barangay` as FormKey);
  };

  const copyCurrentToPermanent = () => {
    setFormData((prev) => ({
      ...prev,
      permanentCountry: prev.currentCountry,
      permanentRegion: prev.currentRegion,
      permanentProvince: prev.currentProvince,
      permanentCity: prev.currentCity,
      permanentBarangay: prev.currentBarangay,
      permanentStreet: prev.currentStreet,
      permanentZipCode: prev.currentZipCode,
      permanentAddress: buildAddress(prev.currentCountry, prev.currentRegion, prev.currentProvince, prev.currentCity, prev.currentBarangay, prev.currentStreet, prev.currentZipCode),
    }));
  };

  const toggleListItem = (key: 'skills' | 'submittedDocuments', value: string) => {
    setFormData((prev) => {
      const current = prev[key] as string[];
      return { ...prev, [key]: current.includes(value) ? current.filter((item) => item !== value) : [...current, value] };
    });
    clearFieldError(key);
  };

  const updateCharacterReference = (index: number, key: keyof CharacterReference, value: string) => {
    setCharacterReferences((prev) => prev.map((reference, currentIndex) => currentIndex === index ? { ...reference, [key]: value } : reference));
  };
  const updateCharacterReferenceName = (index: number, value: string) => updateCharacterReference(index, 'name', value.replace(/[^a-zA-ZÀ-žñÑ .'-]/g, ''));
  const updateCharacterReferenceContact = (index: number, value: string) => updateCharacterReference(index, 'contact', value.replace(/\D/g, '').slice(0, 11));
  const addCharacterReference = () => setCharacterReferences((prev) => [...prev, { name: '', position: '', company: '', contact: '' }]);
  const removeCharacterReference = (index: number) => setCharacterReferences((prev) => prev.length === 1 ? prev : prev.filter((_, currentIndex) => currentIndex !== index));
  const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const validateStep = (stepIndex: number) => {
    const errors: FieldErrors = {};
    if (stepIndex === 0) {
      if (!formData.position) errors.position = 'Position title is required.';
      if (!formData.hearAbout) errors.hearAbout = 'Please select where you heard about the opening.';
      if (formData.hearAbout === 'Other' && !formData.hearAboutOther.trim()) errors.hearAboutOther = 'Please specify where you heard about the opening.';
    }
    if (stepIndex === 1) {
      if (!formData.firstName.trim()) errors.firstName = 'First name is required.';
      if (!formData.lastName.trim()) errors.lastName = 'Last name is required.';
      if (!formData.birthdate) errors.birthdate = 'Date of birth is required.';
      if (formData.birthdate && new Date(formData.birthdate) > new Date()) errors.birthdate = 'Date of birth cannot be in the future.';
      if (!formData.age) errors.age = 'Age is required.';
      if (!formData.gender) errors.gender = 'Gender is required.';
      if (!formData.civilStatus) errors.civilStatus = 'Civil status is required.';
      if (!formData.nationality) errors.nationality = 'Nationality is required.';
      if (!formData.contactNumber) errors.contactNumber = 'Contact number is required.';
      if (formData.contactNumber && formData.contactNumber.length !== 11) errors.contactNumber = 'Contact number must be exactly 11 digits.';
      if (!formData.email.trim()) errors.email = 'Email address is required.';
      if (formData.email && !validateEmail(formData.email)) errors.email = 'Please enter a valid email address.';
      if (!formData.currentCountry) errors.currentCountry = 'Current country is required.';
      if (formData.currentCountry === 'Philippines') {
        if (!formData.currentRegion) errors.currentRegion = 'Current region is required.';
        if (!formData.currentProvince) errors.currentProvince = 'Current province is required.';
        if (!formData.currentCity) errors.currentCity = 'Current city/municipality is required.';
        if (!formData.currentBarangay) errors.currentBarangay = 'Current barangay is required.';
      }
      if (!formData.currentStreet.trim()) errors.currentStreet = 'Current street/address line is required.';
    }
    if (stepIndex === 2) {
      if (!formData.education) errors.education = 'Educational level is required.';
      if (!formData.schoolName.trim()) errors.schoolName = 'School name is required.';
      if (formData.yearGraduated && formData.yearGraduated.length !== 4) errors.yearGraduated = 'Year graduated must be 4 digits.';
      if (formData.employmentStartDate && formData.employmentEndDate && formData.employmentEndDate < formData.employmentStartDate) errors.employmentEndDate = 'End date cannot be earlier than start date.';
      if (formData.totalYearsExperience && Number(formData.totalYearsExperience) > 80) errors.totalYearsExperience = 'Please enter a valid total years of experience.';
    }
    if (stepIndex === 3 && formData.skills.length === 0 && !formData.otherSkills.trim()) errors.skills = 'Please select at least one skill or enter other skills.';
    if (stepIndex === 4) {
      characterReferences.forEach((reference, index) => {
        const hasAnyValue = reference.name.trim() || reference.position.trim() || reference.company.trim() || reference.contact.trim();
        if (index === 0 || hasAnyValue) {
          if (!reference.name.trim()) errors.referenceName = `Reference ${index + 1}: name is required.`;
          if (!reference.position.trim()) errors.referencePosition = `Reference ${index + 1}: position/relationship is required.`;
          if (!reference.contact.trim()) errors.referenceContact = `Reference ${index + 1}: contact number is required.`;
          if (reference.contact && reference.contact.length !== 11) errors.referenceContact = `Reference ${index + 1}: contact number must be exactly 11 digits.`;
        }
      });
      if (!formData.emergencyContactName.trim()) errors.emergencyContactName = 'Emergency contact person is required.';
      if (!formData.emergencyContactRelation.trim()) errors.emergencyContactRelation = 'Relationship is required.';
      if (formData.emergencyContactRelation === 'Other' && !formData.emergencyContactRelationOther.trim()) errors.emergencyContactRelationOther = 'Please specify the relationship.';
      if (!formData.emergencyContactPhone) errors.emergencyContactPhone = 'Emergency contact number is required.';
      if (formData.emergencyContactPhone && formData.emergencyContactPhone.length !== 11) errors.emergencyContactPhone = 'Emergency contact number must be exactly 11 digits.';
    }
    if (stepIndex === 5) {
      if (resumeFiles.length === 0) errors.resumeFiles = 'Resume/Biodata file is required.';
      if (!formData.applicantSignature.trim()) errors.applicantSignature = 'Applicant signature/full name is required.';
      if (!formData.declarationDate) errors.declarationDate = 'Declaration date is required.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) { setError('Please complete the required fields before continuing.'); return false; }
    setError(''); return true;
  };

  const handleStepClick = (targetStep: number) => {
    if (targetStep <= activeStep) { setActiveStep(targetStep); setError(''); return; }
    for (let i = activeStep; i < targetStep; i++) if (!validateStep(i)) return;
    setActiveStep(targetStep);
  };
  const handleNext = () => { if (validateStep(activeStep) && activeStep < steps.length - 1) setActiveStep((prev) => prev + 1); };
  const handleBack = () => { if (activeStep > 0) { setActiveStep((prev) => prev - 1); setError(''); } };
  const validateAllSteps = () => { for (let i = 0; i < steps.length; i++) if (!validateStep(i)) { setActiveStep(i); return false; } return true; };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateAllSteps()) return;
    setSubmitting(true); setError('');
    try {
      const { count, error: countError } = await supabase.from('applicants').select('*', { count: 'exact', head: true });
      if (countError) throw countError;
      const nextNumber = ((count ?? 0) + 1).toString().padStart(4, '0');
      const applicantIdGenerated = `APP-2026-${nextNumber}`;
      const resumeFileData = resumeFiles[0] ? await fileToBase64(resumeFiles[0]) : null;
      const supportingDocumentFiles = await Promise.all(supportingFiles.map(async (file) => ({ name: file.name, type: file.type, data: await fileToBase64(file) })));
      const currentAddress = buildAddress(formData.currentCountry, formData.currentRegion, formData.currentProvince, formData.currentCity, formData.currentBarangay, formData.currentStreet, formData.currentZipCode);
      const permanentAddress = buildAddress(formData.permanentCountry, formData.permanentRegion, formData.permanentProvince, formData.permanentCity, formData.permanentBarangay, formData.permanentStreet, formData.permanentZipCode);
      const employmentPeriod = [formData.employmentStartDate, formData.employmentEndDate].filter(Boolean).join(' to ');
      const coverLetterData = {
        hearAbout: formData.hearAbout, hearAboutOther: formData.hearAboutOther, age: formData.age, nationality: formData.nationality, currentAddress, permanentAddress,
        currentAddressParts: { country: formData.currentCountry, region: formData.currentRegion, province: formData.currentProvince, city: formData.currentCity, barangay: formData.currentBarangay, street: formData.currentStreet, zipCode: formData.currentZipCode },
        permanentAddressParts: { country: formData.permanentCountry, region: formData.permanentRegion, province: formData.permanentProvince, city: formData.permanentCity, barangay: formData.permanentBarangay, street: formData.permanentStreet, zipCode: formData.permanentZipCode },
        educationBackground: { level: formData.education, schoolName: formData.schoolName, courseProgram: formData.courseProgram, yearGraduated: formData.yearGraduated, honorsAwards: formData.honorsAwards },
        workExperience: { companyOrganization: formData.companyOrganization, positionHeld: formData.positionHeld, employmentPeriod, employmentStartDate: formData.employmentStartDate, employmentEndDate: formData.employmentEndDate, dutiesResponsibilities: formData.dutiesResponsibilities, reasonForLeaving: formData.reasonForLeaving, totalYearsExperience: formData.totalYearsExperience, previousSupervisor: formData.previousSupervisor, supervisorContact: formData.supervisorContact },
        skills: formData.skills, otherSkills: formData.otherSkills, certifications: [formData.certification1, formData.certification2, formData.certification3].filter(Boolean),
        characterReferences: characterReferences.filter((reference) => reference.name.trim() || reference.position.trim() || reference.company.trim() || reference.contact.trim()),
        emergencyContact: { name: formData.emergencyContactName, relation: formData.emergencyContactRelation === 'Other' ? formData.emergencyContactRelationOther : formData.emergencyContactRelation, phone: formData.emergencyContactPhone, address: formData.emergencyContactAddress },
        submittedDocuments: formData.submittedDocuments, otherDocument: formData.otherDocument, applicantSignature: formData.applicantSignature, declarationDate: formData.declarationDate,
      };
      const fullName = `${formData.firstName} ${formData.middleName} ${formData.lastName} ${formData.suffix}`.replace(/\s+/g, ' ').trim();
      const { error: insertError } = await supabase.from('applicants').insert({
        applicant_id: applicantIdGenerated, name: fullName, first_name: formData.firstName.trim(), middle_name: formData.middleName.trim(), last_name: formData.lastName.trim(), suffix: formData.suffix,
        gender: formData.gender, civil_status: formData.civilStatus, birthdate: formData.birthdate || null, birthplace: formData.birthplace, height: formData.height, weight: formData.weight,
        email: formData.email.trim().toLowerCase(), phone_number: formData.contactNumber, address: currentAddress, position_applied: formData.position, education: formData.education, experience: formData.totalYearsExperience, cover_letter: JSON.stringify(coverLetterData),
        tin: formData.tin, sss: formData.sss, philhealth: formData.philhealth, pagibig: formData.pagibig,
        emergency_contact: `${formData.emergencyContactName} - ${formData.emergencyContactRelation === 'Other' ? formData.emergencyContactRelationOther : formData.emergencyContactRelation} - ${formData.emergencyContactPhone}`,
        resume_file_name: resumeFiles[0]?.name ?? null, resume_file_data: resumeFileData, supporting_documents: supportingFiles.map((file) => file.name), supporting_document_files: supportingDocumentFiles, status: 'Submitted',
      });
      if (insertError) throw insertError;
      saveApplicationFiles(applicantIdGenerated, { resumeFileName: resumeFiles[0]?.name ?? null, resumeFileData, supportingDocuments: supportingFiles.map((file) => file.name), supportingDocumentFiles });
      const { error: notificationError } = await supabase.from('notifications').insert([
        { recipient_role: 'hr', title: 'New Application Submitted', message: `${formData.firstName} ${formData.lastName} submitted a new application for ${formData.position}.`, type: 'application' },
        { recipient_role: 'gm', title: 'New Application Submitted', message: `${formData.firstName} ${formData.lastName} submitted a new application for ${formData.position}.`, type: 'application' },
      ]);
      if (notificationError) console.warn('Notification insert failed:', notificationError.message);
      setApplicantId(applicantIdGenerated); setSuccessDialog(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong while submitting the application.');
    } finally { setSubmitting(false); }
  };

  const handleCopyId = async () => { setCopyFailed(false); const ok = await copyToClipboard(applicantId); if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2500); } else setCopyFailed(true); };
  const handleCloseDialog = () => { setSuccessDialog(false); setFormData(EMPTY); setFieldErrors({}); setResumeFiles([]); setSupportingFiles([]); setCharacterReferences([{ name: '', position: '', company: '', contact: '' }]); setActiveStep(0); setError(''); };

  const renderCountrySelect = (prefix: 'current' | 'permanent', label = 'Country') => {
    const value = formData[`${prefix}Country` as FormKey] as string;
    return (
      <TextField fullWidth required={prefix === 'current'} select label={label} value={value} onChange={(e) => handleAddressCountryChange(prefix, e.target.value)} sx={textFieldSx} InputLabelProps={{ shrink: true }}>
        {COUNTRIES.map((country) => <MenuItem key={country} value={country}>{country}</MenuItem>)}
      </TextField>
    );
  };

  const renderPhilippineAddressFields = (prefix: 'current' | 'permanent') => {
    const isCurrent = prefix === 'current';
    const country = formData[`${prefix}Country` as FormKey] as string;
    const region = formData[`${prefix}Region` as FormKey] as string;
    const province = formData[`${prefix}Province` as FormKey] as string;
    const city = formData[`${prefix}City` as FormKey] as string;
    const provinceOptions = getProvinceOptions(country, region);
    const cityOptions = getCityOptions(province);
    const barangayOptions = getBarangayOptions(city);

    return (
      <>
        <Grid size={addressGrid}>{renderCountrySelect(prefix)}</Grid>
        <Grid size={addressGrid}>
          <TextField fullWidth required={isCurrent} select label="Region" value={region} onChange={(e) => handleAddressRegionChange(prefix, e.target.value)} error={isCurrent && !!fieldErrors.currentRegion} helperText={isCurrent ? fieldErrors.currentRegion : ''} sx={textFieldSx} InputLabelProps={{ shrink: true }} disabled={country !== 'Philippines'}>
            {Object.keys(PH_PROVINCES_BY_REGION).map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid size={addressGrid}>
          <TextField fullWidth required={isCurrent} select label="Province" value={province} onChange={(e) => handleAddressProvinceChange(prefix, e.target.value)} error={isCurrent && !!fieldErrors.currentProvince} helperText={isCurrent ? fieldErrors.currentProvince : ''} sx={textFieldSx} InputLabelProps={{ shrink: true }} disabled={country !== 'Philippines' || !region}>
            {provinceOptions.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid size={addressGrid}>
          <TextField fullWidth required={isCurrent} select label="City / Municipality" value={city} onChange={(e) => handleAddressCityChange(prefix, e.target.value)} error={isCurrent && !!fieldErrors.currentCity} helperText={isCurrent ? fieldErrors.currentCity : ''} sx={textFieldSx} InputLabelProps={{ shrink: true }} disabled={country !== 'Philippines' || !province}>
            {cityOptions.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid size={addressGrid}>
          <TextField fullWidth required={isCurrent} select label="Barangay" value={formData[`${prefix}Barangay` as FormKey] as string} onChange={(e) => handleAddressBarangayChange(prefix, e.target.value)} error={isCurrent && !!fieldErrors.currentBarangay} helperText={isCurrent ? fieldErrors.currentBarangay : ''} sx={textFieldSx} InputLabelProps={{ shrink: true }} disabled={country !== 'Philippines' || !city}>
            {barangayOptions.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid size={halfGrid}>
          <TextField fullWidth required={isCurrent} label="Street / House No. / Purok" value={formData[`${prefix}Street` as FormKey] as string} onChange={set(`${prefix}Street` as FormKey)} error={isCurrent && !!fieldErrors.currentStreet} helperText={isCurrent ? fieldErrors.currentStreet : ''} inputProps={{ maxLength: 120 }} sx={textFieldSx} />
        </Grid>
        <Grid size={addressGrid}>
          <TextField fullWidth label="ZIP Code" value={formData[`${prefix}ZipCode` as FormKey] as string} InputProps={{ readOnly: true }} helperText={city ? 'Auto-generated from selected city.' : 'Select city to auto-fill.'} sx={textFieldSx} />
        </Grid>
      </>
    );
  };

  return (
    <AuthBackground>
      <Box sx={{ background: 'radial-gradient(circle at top left, rgba(187,247,208,0.75) 0%, rgba(246,251,244,0.98) 36%, #f6fbf4 100%)', borderRadius: { xs: 0, sm: '26px' }, py: { xs: 1.5, sm: 2.5, md: 5 }, px: { xs: 1, sm: 1.5, md: 3 }, minHeight: '100dvh' }}>
        <Container maxWidth="xl" disableGutters sx={{ px: { xs: 0, sm: 2, md: 3 } }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} spacing={2} sx={{ mb: { xs: 2, md: 3 } }}>
            <Box sx={{ minWidth: 0 }}>
              <Chip
                icon={<HomeWorkOutlined sx={{ color: '#166534 !important' }} />}
                label="Applicant Portal"
                sx={{
                  mb: 1.25,
                  borderRadius: '999px',
                  bgcolor: 'rgba(220,252,231,0.92)',
                  color: '#166534',
                  border: '1px solid rgba(34,197,94,0.20)',
                  fontWeight: 900,
                  letterSpacing: '-0.01em',
                }}
              />
              <Typography variant="h3" fontWeight={900} sx={responsiveHeroTitleSx}>Buenaventura Estate</Typography>
              <Typography color="text.secondary" sx={{ mt: 1, fontSize: { xs: '0.9rem', sm: '1rem' }, fontWeight: 650, overflowWrap: 'anywhere' }}>Human Resource Information System — Applicant Portal</Typography>
            </Box>
            <Button variant="contained" startIcon={<ArrowBackRounded />} onClick={() => navigate('/')} sx={{ ...softButtonSx, px: { xs: 2.5, sm: 4 }, py: 1.2, width: { xs: '100%', md: 'auto' }, background: 'linear-gradient(135deg, #166534 0%, #22c55e 100%)', '&:hover': { background: 'linear-gradient(135deg, #14532d 0%, #16a34a 100%)' } }}>Back to Careers</Button>
          </Stack>

          <Paper elevation={0} sx={{ borderRadius: '26px', overflow: 'hidden', background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(22,101,52,0.10)', backdropFilter: 'blur(18px)', boxShadow: { xs: '0 18px 45px rgba(15,23,42,0.10)', md: '0 28px 80px rgba(15,23,42,0.12)' } }}>
            <Box sx={{ p: { xs: 2, sm: 2.5, md: 3.5 }, borderBottom: '1px solid rgba(22,101,52,0.08)' }}>
              <Stack direction={{ xs: 'column', lg: 'row' }} spacing={{ xs: 2, md: 3 }} justifyContent="space-between" alignItems={{ xs: 'stretch', lg: 'center' }}>
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <Box
                    sx={{
                      width: 46,
                      height: 46,
                      minWidth: 46,
                      borderRadius: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#166534',
                      background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
                      boxShadow: '0 14px 30px rgba(22,101,52,0.14)',
                    }}
                  >
                    <AssignmentTurnedInOutlined />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h4" fontWeight={900} sx={responsiveFormTitleSx}>Job Application Form</Typography>
                    <Typography color="text.secondary" sx={{ fontSize: { xs: '0.9rem', sm: '1rem' }, fontWeight: 650 }}>Complete your application details and upload your requirements.</Typography>
                  </Box>
                </Stack>
                <Box
                  sx={{
                    width: { xs: '100%', lg: 720 },
                    maxWidth: '100%',
                    pb: { xs: 0.5, sm: 1 },
                    '@keyframes stepPulse': {
                      '0%': { boxShadow: '0 0 0 0 rgba(22, 163, 74, 0.35)' },
                      '70%': { boxShadow: '0 0 0 12px rgba(22, 163, 74, 0)' },
                      '100%': { boxShadow: '0 0 0 0 rgba(22, 163, 74, 0)' },
                    },
                  }}
                >
                  <Box sx={{ position: 'relative', width: '100%', px: { xs: 0, sm: 1.5 }, pt: 1 }}>
                    <Box
                      sx={{
                        position: 'absolute',
                        top: { xs: 23, sm: 27, md: 30 },
                        left: `${100 / (steps.length * 2)}%`,
                        right: `${100 / (steps.length * 2)}%`,
                        height: { xs: 3, sm: 4, md: 5 },
                        borderRadius: 999,
                        backgroundColor: '#dcfce7',
                        zIndex: 0,
                      }}
                    />
                    <Box
                      sx={{
                        position: 'absolute',
                        top: { xs: 23, sm: 27, md: 30 },
                        left: `${100 / (steps.length * 2)}%`,
                        right: `${100 / (steps.length * 2)}%`,
                        height: { xs: 3, sm: 4, md: 5 },
                        borderRadius: 999,
                        background: 'linear-gradient(90deg, #16a34a 0%, #22c55e 100%)',
                        transform: `scaleX(${activeStep / (steps.length - 1)})`,
                        transformOrigin: 'left center',
                        transition: 'transform 500ms ease',
                        zIndex: 1,
                        boxShadow: activeStep > 0 ? '0 0 18px rgba(22, 163, 74, 0.35)' : 'none',
                      }}
                    />

                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="flex-start"
                      sx={{ position: 'relative', zIndex: 2, width: '100%' }}
                    >
                      {steps.map((step, index) => {
                        const isCompleted = index < activeStep;
                        const isCurrent = index === activeStep;
                        const isReached = index <= activeStep;

                        return (
                          <Stack
                            key={step}
                            alignItems="center"
                            spacing={{ xs: 0.5, sm: 1 }}
                            onClick={() => handleStepClick(index)}
                            sx={{
                              cursor: 'pointer',
                              width: `${100 / steps.length}%`,
                              minWidth: 0,
                              px: { xs: 0.25, sm: 0.5 },
                              transition: 'transform 250ms ease',
                              '&:hover': { transform: { xs: 'none', sm: 'translateY(-3px)' } },
                            }}
                          >
                            <Box
                              sx={{
                                width: { xs: 34, sm: 42, md: 46 },
                                height: { xs: 34, sm: 42, md: 46 },
                                minWidth: { xs: 34, sm: 42, md: 46 },
                                minHeight: { xs: 34, sm: 42, md: 46 },
                                borderRadius: '50%',
                                background: isReached
                                  ? 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)'
                                  : '#f0fdf4',
                                color: isReached ? '#fff' : '#166534',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 900,
                                fontSize: { xs: '0.8rem', sm: '0.95rem', md: '1rem' },
                                border: isReached ? '2px solid #86efac' : '1.5px solid #bbf7d0',
                                boxShadow: isCurrent
                                  ? '0 10px 24px rgba(22, 163, 74, 0.30)'
                                  : isCompleted
                                    ? '0 8px 18px rgba(22, 163, 74, 0.18)'
                                    : '0 4px 12px rgba(15, 23, 42, 0.06)',
                                transform: isCurrent ? { xs: 'scale(1.04)', sm: 'scale(1.08)' } : 'scale(1)',
                                transition: 'all 300ms ease',
                                animation: isCurrent ? 'stepPulse 1.8s ease-in-out infinite' : 'none',
                              }}
                            >
                              {isCompleted ? <CheckCircleOutlineRounded sx={stepIconSx} /> : stepIcons[index]}
                            </Box>
                            <Typography
                              variant="caption"
                              sx={{
                                display: { xs: 'none', sm: 'block' },
                                fontWeight: 800,
                                color: isReached ? '#14532d' : '#475569',
                                textAlign: 'center',
                                lineHeight: 1.2,
                                transition: 'color 250ms ease',
                                fontSize: { sm: '0.68rem', md: '0.75rem' },
                                maxWidth: 110,
                                overflowWrap: 'anywhere',
                              }}
                            >
                              {step}
                            </Typography>
                          </Stack>
                        );
                      })}
                    </Stack>
                    <Typography
                      variant="body2"
                      sx={{
                        display: { xs: 'block', sm: 'none' },
                        mt: 1.5,
                        textAlign: 'center',
                        fontWeight: 800,
                        color: '#14532d',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      Step {activeStep + 1} of {steps.length}: {steps[activeStep]}
                    </Typography>
                  </Box>
                </Box>
              </Stack>
            </Box>

            <Box component="form" onSubmit={handleSubmit} sx={{ p: { xs: 1.5, sm: 2.5, md: 4.5 } }}>
              {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

              {activeStep === 0 && (
                <Paper elevation={0} sx={stepPaperSx}>
                  <SectionTitle icon={<WorkOutline />} title="I. Position Applied For" description="Select the position you are applying for and how you found this job opening." />
                  <Grid container spacing={2.5}>
                    <Grid size={halfGrid}>
                      <TextField
                        fullWidth
                        required
                        select
                        label="Position Title"
                        value={formData.position}
                        onChange={set('position')}
                        disabled={positionsLoading || openPositions.length === 0}
                        error={!!fieldErrors.position}
                        helperText={
                          fieldErrors.position ||
                          (positionsLoading
                            ? 'Loading current open positions...'
                            : openPositions.length === 0
                              ? 'No open positions are currently available.'
                              : 'Only active job postings from the Landing Page are shown here.')
                        }
                        InputLabelProps={{ shrink: true }}
                        sx={textFieldSx}
                      >
                        {positionsLoading && (
                          <MenuItem value="" disabled>
                            Loading open positions...
                          </MenuItem>
                        )}
                        {!positionsLoading && openPositions.length === 0 && (
                          <MenuItem value="" disabled>
                            No open positions available
                          </MenuItem>
                        )}
                        {openPositions.map((position) => (
                          <MenuItem key={position} value={position}>
                            {position}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid size={halfGrid}><TextField fullWidth required select label="How did you hear about this job opening?" value={formData.hearAbout} onChange={set('hearAbout')} error={!!fieldErrors.hearAbout} helperText={fieldErrors.hearAbout} InputLabelProps={{ shrink: true }} sx={textFieldSx}>{HEAR_ABOUT_OPTIONS.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}</TextField></Grid>
                    {formData.hearAbout === 'Other' && <Grid size={{ xs: 12 }}><TextField fullWidth required label="Please specify" value={formData.hearAboutOther} onChange={set('hearAboutOther')} error={!!fieldErrors.hearAboutOther} helperText={fieldErrors.hearAboutOther} inputProps={{ maxLength: 120 }} sx={textFieldSx} /></Grid>}
                  </Grid>
                </Paper>
              )}

              {activeStep === 1 && (
                <Paper elevation={0} sx={stepPaperSx}>
                  <SectionTitle icon={<PersonOutline />} title="II. Personal Details" description="Enter your personal details and complete address information accurately." />
                  <Grid container spacing={2.5}>
                    <Grid size={nameGrid}><TextField fullWidth required label="First Name" value={formData.firstName} onChange={setUpperText('firstName')} error={!!fieldErrors.firstName} helperText={fieldErrors.firstName} inputProps={{ maxLength: 50 }} sx={textFieldSx} /></Grid>
                    <Grid size={nameGrid}><TextField fullWidth label="Middle Name" value={formData.middleName} onChange={setUpperText('middleName')} inputProps={{ maxLength: 50 }} sx={textFieldSx} /></Grid>
                    <Grid size={nameGrid}><TextField fullWidth required label="Last Name" value={formData.lastName} onChange={setUpperText('lastName')} error={!!fieldErrors.lastName} helperText={fieldErrors.lastName} inputProps={{ maxLength: 50 }} sx={textFieldSx} /></Grid>
                    <Grid size={nameGrid}><TextField fullWidth select label="Suffix" value={formData.suffix} onChange={set('suffix')} InputLabelProps={{ shrink: true }} sx={textFieldSx}>{SUFFIXES.map((suffix) => <MenuItem key={suffix || 'none'} value={suffix}>{suffix || 'None'}</MenuItem>)}</TextField></Grid>
                    <Grid size={fieldGrid}><TextField fullWidth required type="date" label="Date of Birth" value={formData.birthdate} onChange={setBirthdate} error={!!fieldErrors.birthdate} helperText={fieldErrors.birthdate} InputLabelProps={{ shrink: true }} sx={textFieldSx} /></Grid>
                    <Grid size={fieldGrid}><TextField fullWidth required label="Age" value={formData.age} onChange={setNumeric('age', 3)} error={!!fieldErrors.age} helperText={fieldErrors.age || 'Auto-computed from birthdate but editable.'} inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 3 }} sx={textFieldSx} /></Grid>
                    <Grid size={fieldGrid}><TextField fullWidth required select label="Gender" value={formData.gender} onChange={set('gender')} error={!!fieldErrors.gender} helperText={fieldErrors.gender} InputLabelProps={{ shrink: true }} sx={textFieldSx}>{GENDER.map((gender) => <MenuItem key={gender} value={gender}>{gender}</MenuItem>)}</TextField></Grid>
                    <Grid size={fieldGrid}><TextField fullWidth required select label="Civil Status" value={formData.civilStatus} onChange={set('civilStatus')} error={!!fieldErrors.civilStatus} helperText={fieldErrors.civilStatus} InputLabelProps={{ shrink: true }} sx={textFieldSx}>{CIVIL_STATUS.map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}</TextField></Grid>
                    <Grid size={fieldGrid}><TextField fullWidth required select label="Nationality" value={formData.nationality} onChange={set('nationality')} error={!!fieldErrors.nationality} helperText={fieldErrors.nationality} InputLabelProps={{ shrink: true }} sx={textFieldSx}>{NATIONALITIES.map((nationality) => <MenuItem key={nationality} value={nationality}>{nationality}</MenuItem>)}</TextField></Grid>
                    <Grid size={fieldGrid}><TextField fullWidth required label="Contact Number" value={formData.contactNumber} onChange={setPhone('contactNumber')} error={!!fieldErrors.contactNumber} helperText={fieldErrors.contactNumber || '11-digit mobile number only.'} inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 11 }} sx={textFieldSx} /></Grid>
                    <Grid size={fieldGrid}><TextField fullWidth required type="email" label="Email Address" value={formData.email} onChange={setEmail} error={!!fieldErrors.email} helperText={fieldErrors.email} inputProps={{ maxLength: 80 }} sx={textFieldSx} /></Grid>
                    <Grid size={{ xs: 12 }}><Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1, mb: 1 }}><LocationOnOutlined sx={{ color: '#166534' }} /><Typography fontWeight={900} sx={{ color: '#14532d' }}>Current Address</Typography></Stack></Grid>
                    {renderPhilippineAddressFields('current')}
                    <Grid size={{ xs: 12 }}><Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" spacing={2} sx={{ mt: 2, mb: 1 }}><Stack direction="row" spacing={1} alignItems="center"><HomeWorkOutlined sx={{ color: '#166534' }} /><Typography fontWeight={900} sx={{ color: '#14532d' }}>Permanent Address</Typography></Stack><Button type="button" variant="outlined" onClick={copyCurrentToPermanent} sx={{ ...softButtonSx, borderColor: '#166534', color: '#166534', background: '#ffffff', minHeight: { xs: 44, sm: 46 } }}>Same as Current Address</Button></Stack></Grid>
                    {renderPhilippineAddressFields('permanent')}
                  </Grid>
                </Paper>
              )}

              {activeStep === 2 && (
                <Paper elevation={0} sx={stepPaperSx}>
                  <SectionTitle icon={<SchoolOutlined />} title="III. Educational Background and IV. Work Experience" description="Provide your educational background and previous work experience, if applicable." />
                  <Stack spacing={3}>
                    <Paper elevation={0} sx={nestedPaperSx}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}><SchoolOutlined sx={{ color: '#166534' }} /><Typography fontWeight={900} sx={{ color: '#14532d' }}>Educational Background</Typography></Stack>
                      <Grid container spacing={2.5}>
                        <Grid size={fieldGrid}><TextField fullWidth required select label="Educational Level" value={formData.education} onChange={set('education')} error={!!fieldErrors.education} helperText={fieldErrors.education} InputLabelProps={{ shrink: true }} sx={textFieldSx}>{EDUCATIONAL_ATTAINMENT.map((level) => <MenuItem key={level} value={level}>{level}</MenuItem>)}</TextField></Grid>
                        <Grid size={fieldGrid}><TextField fullWidth required label="Name of School" value={formData.schoolName} onChange={set('schoolName')} error={!!fieldErrors.schoolName} helperText={fieldErrors.schoolName} inputProps={{ maxLength: 120 }} sx={textFieldSx} /></Grid>
                        <Grid size={fieldGrid}><TextField fullWidth label="Course / Program" value={formData.courseProgram} onChange={set('courseProgram')} inputProps={{ maxLength: 120 }} sx={textFieldSx} /></Grid>
                        <Grid size={fieldGrid}><TextField fullWidth label="Year Graduated" value={formData.yearGraduated} onChange={setNumeric('yearGraduated', 4)} error={!!fieldErrors.yearGraduated} helperText={fieldErrors.yearGraduated} inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 4 }} sx={textFieldSx} /></Grid>
                        <Grid size={fullOnMobileGrid}><TextField fullWidth label="Honors / Awards" value={formData.honorsAwards} onChange={set('honorsAwards')} inputProps={{ maxLength: 160 }} sx={textFieldSx} /></Grid>
                      </Grid>
                    </Paper>
                    <Paper elevation={0} sx={nestedPaperSx}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}><WorkOutline sx={{ color: '#166534' }} /><Typography fontWeight={900} sx={{ color: '#14532d' }}>Work Experience</Typography></Stack>
                      <Grid container spacing={2.5}>
                        <Grid size={fieldGrid}><TextField fullWidth label="Company / Organization" value={formData.companyOrganization} onChange={set('companyOrganization')} inputProps={{ maxLength: 120 }} sx={textFieldSx} /></Grid>
                        <Grid size={fieldGrid}><TextField fullWidth label="Position Held" value={formData.positionHeld} onChange={set('positionHeld')} inputProps={{ maxLength: 120 }} sx={textFieldSx} /></Grid>
                        <Grid size={fieldGrid}><TextField fullWidth label="Total Years of Work Experience" value={formData.totalYearsExperience} onChange={setNumeric('totalYearsExperience', 2)} error={!!fieldErrors.totalYearsExperience} helperText={fieldErrors.totalYearsExperience} inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 2 }} sx={textFieldSx} /></Grid>
                        <Grid size={halfGrid}><TextField fullWidth type="date" label="Employment Start Date" value={formData.employmentStartDate} onChange={set('employmentStartDate')} InputLabelProps={{ shrink: true }} sx={textFieldSx} /></Grid>
                        <Grid size={halfGrid}><TextField fullWidth type="date" label="Employment End Date" value={formData.employmentEndDate} onChange={set('employmentEndDate')} error={!!fieldErrors.employmentEndDate} helperText={fieldErrors.employmentEndDate} InputLabelProps={{ shrink: true }} sx={textFieldSx} /></Grid>
                        <Grid size={halfGrid}><TextField fullWidth multiline minRows={3} label="Duties / Responsibilities" value={formData.dutiesResponsibilities} onChange={set('dutiesResponsibilities')} inputProps={{ maxLength: 500 }} sx={textFieldSx} /></Grid>
                        <Grid size={halfGrid}><TextField fullWidth multiline minRows={3} label="Reason for Leaving" value={formData.reasonForLeaving} onChange={set('reasonForLeaving')} inputProps={{ maxLength: 500 }} sx={textFieldSx} /></Grid>
                        <Grid size={halfGrid}><TextField fullWidth label="Previous Supervisor / Manager" value={formData.previousSupervisor} onChange={setUpperText('previousSupervisor')} inputProps={{ maxLength: 120 }} sx={textFieldSx} /></Grid>
                        <Grid size={halfGrid}><TextField fullWidth label="Supervisor Contact Number / Email" value={formData.supervisorContact} onChange={set('supervisorContact')} inputProps={{ maxLength: 120 }} sx={textFieldSx} /></Grid>
                      </Grid>
                    </Paper>
                  </Stack>
                </Paper>
              )}

              {activeStep === 3 && (
                <Paper elevation={0} sx={stepPaperSx}>
                  <SectionTitle icon={<AutoAwesomeOutlined />} title="V. Skills and Qualifications" description="Select the skills that apply to you. You may also add other skills and trainings." />
                  {fieldErrors.skills && <Alert severity="warning" sx={{ mb: 2 }}>{fieldErrors.skills}</Alert>}
                  <FormGroup row>{SKILLS.map((skill) => <FormControlLabel key={skill} control={<Checkbox checked={formData.skills.includes(skill)} onChange={() => toggleListItem('skills', skill)} />} label={skill} sx={compactChoiceSx} />)}</FormGroup>
                  <Grid container spacing={2.5} sx={{ mt: 1 }}>
                    <Grid size={{ xs: 12 }}><TextField fullWidth label="Other Skills" value={formData.otherSkills} onChange={set('otherSkills')} inputProps={{ maxLength: 200 }} sx={textFieldSx} /></Grid>
                    <Grid size={fieldGrid}><TextField fullWidth label="Certification / Training 1" value={formData.certification1} onChange={set('certification1')} inputProps={{ maxLength: 160 }} sx={textFieldSx} /></Grid>
                    <Grid size={fieldGrid}><TextField fullWidth label="Certification / Training 2" value={formData.certification2} onChange={set('certification2')} inputProps={{ maxLength: 160 }} sx={textFieldSx} /></Grid>
                    <Grid size={fieldGrid}><TextField fullWidth label="Certification / Training 3" value={formData.certification3} onChange={set('certification3')} inputProps={{ maxLength: 160 }} sx={textFieldSx} /></Grid>
                  </Grid>
                </Paper>
              )}

              {activeStep === 4 && (
                <Paper elevation={0} sx={stepPaperSx}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={2} sx={{ mb: 1 }}>
                    <SectionTitle icon={<Groups2Outlined />} title="VI. Character References and Emergency Contact" description="Add character references and emergency contact information." />
                    <Button type="button" variant="outlined" startIcon={<Add />} onClick={addCharacterReference} sx={{ ...softButtonSx, borderColor: '#166534', color: '#166534', background: '#ffffff', minHeight: { xs: 44, sm: 46 } }}>Add Character Reference</Button>
                  </Stack>
                  {fieldErrors.referenceName && <Alert severity="warning" sx={{ mb: 2 }}>{fieldErrors.referenceName}</Alert>}
                  {fieldErrors.referencePosition && <Alert severity="warning" sx={{ mb: 2 }}>{fieldErrors.referencePosition}</Alert>}
                  {fieldErrors.referenceContact && <Alert severity="warning" sx={{ mb: 2 }}>{fieldErrors.referenceContact}</Alert>}
                  <Stack spacing={2.5}>{characterReferences.map((reference, index) => <Paper key={`reference-${index}`} elevation={0} sx={nestedPaperSx}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={2} sx={{ mb: 2 }}><Stack direction="row" spacing={1} alignItems="center"><Groups2Outlined sx={{ color: '#166534' }} /><Typography fontWeight={900} sx={{ color: '#14532d' }}>Character Reference {index + 1}</Typography></Stack>{characterReferences.length > 1 && <Button type="button" color="error" variant="outlined" startIcon={<Delete />} onClick={() => removeCharacterReference(index)} sx={{ ...softButtonSx, minHeight: 40 }}>Remove</Button>}</Stack><Grid container spacing={2.5}><Grid size={fieldGrid}><TextField fullWidth label="Reference Name" value={reference.name} onChange={(e) => updateCharacterReferenceName(index, e.target.value)} inputProps={{ maxLength: 80 }} sx={textFieldSx} /></Grid><Grid size={fieldGrid}><TextField fullWidth label="Position" value={reference.position} onChange={(e) => updateCharacterReference(index, 'position', e.target.value)} inputProps={{ maxLength: 80 }} sx={textFieldSx} /></Grid><Grid size={fieldGrid}><TextField fullWidth label="Company / Organization" value={reference.company} onChange={(e) => updateCharacterReference(index, 'company', e.target.value)} inputProps={{ maxLength: 120 }} sx={textFieldSx} /></Grid><Grid size={fieldGrid}><TextField fullWidth label="Reference Contact Number" value={reference.contact} onChange={(e) => updateCharacterReferenceContact(index, e.target.value)} helperText="11-digit contact number only." inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 11 }} sx={textFieldSx} /></Grid></Grid></Paper>)}</Stack>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 4, mb: 2 }}><FavoriteBorderRounded sx={{ color: '#166534' }} /><Typography variant="h6" fontWeight={900} sx={{ color: '#14532d' }}>Emergency Contact</Typography></Stack>
                  <Grid container spacing={2.5}>
                    <Grid size={fieldGrid}><TextField fullWidth required label="Emergency Contact Person" value={formData.emergencyContactName} onChange={setUpperText('emergencyContactName')} error={!!fieldErrors.emergencyContactName} helperText={fieldErrors.emergencyContactName} inputProps={{ maxLength: 80 }} sx={textFieldSx} /></Grid>
                    <Grid size={fieldGrid}><TextField fullWidth required select label="Relationship" value={formData.emergencyContactRelation} onChange={set('emergencyContactRelation')} error={!!fieldErrors.emergencyContactRelation} helperText={fieldErrors.emergencyContactRelation} InputLabelProps={{ shrink: true }} sx={textFieldSx}>{RELATIONSHIPS.map((relationship) => <MenuItem key={relationship} value={relationship}>{relationship}</MenuItem>)}</TextField></Grid>
                    {formData.emergencyContactRelation === 'Other' && <Grid size={fieldGrid}><TextField fullWidth required label="Please specify relationship" value={formData.emergencyContactRelationOther} onChange={setUpperText('emergencyContactRelationOther')} error={!!fieldErrors.emergencyContactRelationOther} helperText={fieldErrors.emergencyContactRelationOther} inputProps={{ maxLength: 80 }} sx={textFieldSx} /></Grid>}
                    <Grid size={fieldGrid}><TextField fullWidth required label="Emergency Contact Number" value={formData.emergencyContactPhone} onChange={setPhone('emergencyContactPhone')} error={!!fieldErrors.emergencyContactPhone} helperText={fieldErrors.emergencyContactPhone || '11-digit contact number only.'} inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 11 }} sx={textFieldSx} /></Grid>
                    <Grid size={{ xs: 12, md: formData.emergencyContactRelation === 'Other' ? 12 : 8 }}><TextField fullWidth label="Emergency Contact Address" value={formData.emergencyContactAddress} onChange={set('emergencyContactAddress')} inputProps={{ maxLength: 160 }} sx={textFieldSx} /></Grid>
                  </Grid>
                </Paper>
              )}

              {activeStep === 5 && (
                <Paper elevation={0} sx={stepPaperSx}>
                  <SectionTitle icon={<DescriptionOutlined />} title="VII. Required Documents and VIII. Applicant Declaration" description="Upload your resume and confirm the accuracy of your submitted information." />
                  <FormGroup row>{REQUIRED_DOCUMENTS.map((documentName) => <FormControlLabel key={documentName} control={<Checkbox checked={formData.submittedDocuments.includes(documentName)} onChange={() => toggleListItem('submittedDocuments', documentName)} />} label={documentName} sx={compactChoiceSx} />)}</FormGroup>
                  <Grid container spacing={2.5} sx={{ mt: 1 }}>
                    <Grid size={{ xs: 12 }}><TextField fullWidth label="Other Document" value={formData.otherDocument} onChange={set('otherDocument')} inputProps={{ maxLength: 120 }} sx={textFieldSx} /></Grid>
                    <Grid size={halfGrid}><Button fullWidth component="label" variant="outlined" startIcon={<UploadFile />} sx={uploadButtonSx}><input hidden type="file" accept="*/*" onChange={(e) => { const files = Array.from(e.target.files ?? []); setResumeFiles(files.slice(0, 1)); clearFieldError('resumeFiles'); }} />{resumeFiles[0] ? `Resume: ${resumeFiles[0].name}` : 'Select Resume / Biodata'}</Button>{fieldErrors.resumeFiles && <Typography color="error" variant="caption" sx={{ mt: 1, display: 'block' }}>{fieldErrors.resumeFiles}</Typography>}</Grid>
                    <Grid size={halfGrid}><Button fullWidth component="label" variant="outlined" startIcon={<UploadFile />} sx={uploadButtonSx}><input hidden multiple type="file" onChange={(e) => { const selectedFiles = Array.from(e.target.files ?? []); setSupportingFiles((prev) => [...prev, ...selectedFiles]); e.target.value = ''; }} />{supportingFiles.length > 0 ? `Add More Supporting Documents (${supportingFiles.length} selected)` : 'Select Supporting Documents'}</Button></Grid>
                    <Grid size={{ xs: 12 }}>{supportingFiles.length > 0 && <Paper elevation={0} sx={{ p: 2, borderRadius: 3, bgcolor: '#f9fcf9', border: '1px solid #cfe5d5' }}><Stack spacing={1}>{supportingFiles.map((file, fileIndex) => <Stack key={`${file.name}-${file.lastModified}-${fileIndex}`} direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }}><Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}><ArticleOutlined sx={{ color: '#166534', fontSize: 18 }} /><Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere', fontWeight: 700 }}>{file.name}</Typography></Stack><Button type="button" size="small" color="error" variant="outlined" onClick={() => setSupportingFiles((prev) => prev.filter((_, currentIndex) => currentIndex !== fileIndex))} sx={{ textTransform: 'none', fontWeight: 800 }}>Remove</Button></Stack>)}</Stack></Paper>}</Grid>
                    <Grid size={{ xs: 12 }}><Alert severity="info">I hereby certify that all information provided in this application form is true, complete, and correct to the best of my knowledge. I understand that any false information or omission may result in the rejection of my application or termination of employment if hired.</Alert></Grid>
                    <Grid size={halfGrid}><TextField fullWidth required label="Applicant's Signature / Full Name" value={formData.applicantSignature} onChange={setUpperText('applicantSignature')} error={!!fieldErrors.applicantSignature} helperText={fieldErrors.applicantSignature} inputProps={{ maxLength: 120 }} sx={textFieldSx} /></Grid>
                    <Grid size={halfGrid}><TextField fullWidth required type="date" label="Date" value={formData.declarationDate} onChange={set('declarationDate')} error={!!fieldErrors.declarationDate} helperText={fieldErrors.declarationDate} InputLabelProps={{ shrink: true }} sx={textFieldSx} /></Grid>
                  </Grid>
                </Paper>
              )}

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems="center" sx={{ mt: 3, pt: 2 }}>
                <Button type="button" variant="outlined" startIcon={<ArrowBackRounded />} onClick={activeStep === 0 ? () => navigate('/') : handleBack} sx={{ ...softButtonSx, px: { xs: 2.5, sm: 5 }, py: 1.5, borderColor: '#166534', color: '#166534', minWidth: 160, width: { xs: '100%', sm: 'auto' }, background: '#ffffff' }}>{activeStep === 0 ? 'Cancel' : 'Back'}</Button>
                {activeStep < steps.length - 1 ? <Button type="button" variant="contained" endIcon={<ArrowForwardRounded />} onClick={handleNext} sx={{ ...softButtonSx, px: { xs: 2.5, sm: 6 }, py: 1.5, minWidth: 180, width: { xs: '100%', sm: 'auto' }, background: 'linear-gradient(135deg, #166534 0%, #22c55e 100%)', boxShadow: '0 12px 25px rgba(22,101,52,0.25)' }}>Next Step</Button> : <Button type="submit" variant="contained" startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <Send />} disabled={submitting} sx={{ ...softButtonSx, px: { xs: 2.5, sm: 6 }, py: 1.5, minWidth: 220, width: { xs: '100%', sm: 'auto' }, background: 'linear-gradient(135deg, #166534 0%, #22c55e 100%)', boxShadow: '0 12px 25px rgba(22,101,52,0.25)' }}>{submitting ? 'Submitting...' : 'Submit Application'}</Button>}
              </Stack>
            </Box>
          </Paper>
        </Container>
      </Box>

      <Dialog open={successDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '26px', border: '1px solid rgba(22,101,52,0.12)', boxShadow: '0 28px 80px rgba(15,23,42,0.18)' } }}>
        <DialogContent sx={{ textAlign: 'center', p: { xs: 2.5, sm: 4 } }}><Box sx={{ width: { xs: 68, sm: 78 }, height: { xs: 68, sm: 78 }, borderRadius: '22px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', mb: 2, background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', color: '#166534', boxShadow: '0 16px 34px rgba(22,101,52,0.18)' }}><VerifiedUserOutlined sx={{ fontSize: { xs: 42, sm: 50 } }} /></Box><Typography variant="h5" fontWeight={900} gutterBottom>Application Submitted Successfully</Typography><Typography color="text.secondary" sx={{ mb: 3 }}>Please save your Applicant ID. You will use this to track your application status.</Typography><Paper elevation={0} sx={{ p: 2, borderRadius: 3, bgcolor: 'rgba(31,122,71,0.08)', border: '1px solid rgba(31,122,71,0.18)', mb: 2 }}><Typography variant="h6" fontWeight={900} color="primary" sx={{ overflowWrap: 'anywhere' }}>{applicantId}</Typography></Paper>{copied && <Alert severity="success" sx={{ mb: 2 }}>Applicant ID copied!</Alert>}{copyFailed && <Alert severity="error" sx={{ mb: 2 }}>Unable to copy Applicant ID.</Alert>}</DialogContent>
        <DialogActions sx={{ p: { xs: 2, sm: 3 }, justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}><Button variant="outlined" startIcon={<ContentCopy />} onClick={handleCopyId} sx={{ ...softButtonSx, borderColor: '#166534', color: '#166534', background: '#ffffff', width: { xs: '100%', sm: 'auto' } }}>Copy Applicant ID</Button><Button variant="contained" onClick={() => navigate('/track')} sx={{ ...softButtonSx, background: 'linear-gradient(135deg, #1F7A47 0%, #3FA46A 100%)', width: { xs: '100%', sm: 'auto' } }}>Track Application</Button><Button onClick={handleCloseDialog} sx={{ ...softButtonSx, width: { xs: '100%', sm: 'auto' } }}>Close</Button></DialogActions>
      </Dialog>
    </AuthBackground>
  );
}
