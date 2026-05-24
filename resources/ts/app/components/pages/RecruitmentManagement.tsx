import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { loadApplicationFiles } from '../../lib/localDb';
import {
  Sync,
  CalendarMonth,
  TaskAlt,
  Event,
  CancelOutlined,
  PictureAsPdf,
  Article,
  FileDownload,
  InsertDriveFile,
  Visibility,
  Image as ImageIcon,
  EditNote,
  AddCircle,
  RemoveCircle,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  FormGroup,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Snackbar,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useAuth } from '../../context/AuthContext';

interface DocFile {
  name: string;
  type: string;
  data: string; // base64 data URI
}

type DocumentItem = { name: string; data?: string; type?: string };

type AppStatus =
  | 'Submitted'
  | 'Under Review'
  | 'Missing Requirements'
  | 'For Interview'
  | 'Hired'
  | 'Not Qualified'
  | 'Not Hired';

interface Application {
  id: string;
  name: string;
  position: string;
  dateApplied: string;
  status: AppStatus;

  // Name parts
  firstName?: string;
  middleName?: string;
  lastName?: string;
  suffix?: string;

  // Personal info
  gender?: string;
  civilStatus?: string;
  birthdate?: string;
  birthplace?: string;
  height?: string;
  weight?: string;

  // Contact
  email: string;
  phone: string;
  address?: string;

  // Employment
  experience?: string;
  education?: string;
  coverLetter?: string;

  // Government IDs
  tin?: string;
  sss?: string;
  philhealth?: string;
  pagibig?: string;

  // Emergency contact
  emergencyContact?: string;

  // Submitted documents
  resumeFileName?: string;
  resumeFileData?: string;
  supportingDocuments?: string[];
  supportingDocumentFiles?: DocFile[];

  // Requirements
  hasResume?: boolean;
  hasBirthCert?: boolean;
  hasTOR?: boolean;
  hasMedCert?: boolean;
  requirementsNote?: string;
  customRequirements?: { label: string; checked: boolean }[];

  // Interview
  interviewDate?: string;
  interviewTime?: string;
  interviewLocation?: string;
  interviewNotes?: string;
  interviewFeedback?: string;
  hiringDecision?: string;
  scheduledBy?: string;

  raw?: any;
}

const STATUS_COLORS: Record<AppStatus, 'default' | 'primary' | 'warning' | 'info' | 'success' | 'error'> = {
  Submitted: 'default',
  'Under Review': 'primary',
  'Missing Requirements': 'warning',
  'For Interview': 'info',
  Hired: 'success',
  'Not Qualified': 'error',
  'Not Hired': 'error',
};

const ALL_STATUSES: AppStatus[] = [
  'Submitted',
  'Under Review',
  'Missing Requirements',
  'For Interview',
  'Hired',
  'Not Qualified',
  'Not Hired',
];

const APPLICANT_LIST_COLUMNS = `
  applicant_id,
  name,
  first_name,
  middle_name,
  last_name,
  suffix,
  position_applied,
  created_at,
  status,
  email,
  phone_number,
  interview_date,
  interview_time,
  interview_location,
  interview_notes,
  scheduled_by,
  has_resume,
  has_birth_cert,
  has_tor,
  has_med_cert,
  requirements_note,
  custom_requirements,
  supporting_documents
`;

const MINIMAL_APPLICANT_LIST_COLUMNS = `
  applicant_id,
  first_name,
  middle_name,
  last_name,
  suffix,
  position_applied,
  created_at,
  status,
  interview_date,
  interview_time
`;

const APPLICANT_PROFILE_COLUMNS = `
  applicant_id,
  name,
  first_name,
  middle_name,
  last_name,
  suffix,
  position_applied,
  created_at,
  status,
  email,
  phone_number,
  address,
  gender,
  civil_status,
  birthdate,
  birthplace,
  height,
  weight,
  education,
  experience,
  cover_letter,
  tin,
  sss,
  philhealth,
  pagibig,
  emergency_contact,
  resume_file_name,
  supporting_documents,
  has_resume,
  has_birth_cert,
  has_tor,
  has_med_cert,
  requirements_note,
  custom_requirements,
  interview_date,
  interview_time,
  interview_location,
  interview_notes,
  interview_feedback,
  hiring_decision,
  scheduled_by
`;

const PROFILE_DIALOG_TIMEOUT_MS = 10000;
const DOCUMENT_LOAD_TIMEOUT_MS = 15000;

const displayValue = (value: any) => {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const safeJsonParse = (value?: string) => {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

const ensureArray = <T,>(value: T[] | string | null | undefined): T[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const formatDateTime = (dateString?: string) => {
  if (!dateString) return '—';

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return displayValue(dateString);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12;
  hours = hours || 12;

  return `${year}-${month}-${day} ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
};

const formatInterviewDateTime = (date?: string, time?: string) => {
  if (!date) return '—';
  return formatDateTime(time ? `${date}T${time}` : date);
};

const withTimeout = <T,>(
  promise: PromiseLike<T>,
  timeoutMs = 15000,
  message = 'The request took too long. Please check your connection and try again.'
) =>
  new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);

    Promise.resolve(promise)
      .then(result => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });

const waitForNextPaint = () =>
  new Promise<void>(resolve => {
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      setTimeout(resolve, 0);
      return;
    }

    window.requestAnimationFrame(() => resolve());
  });

const buildApplicantFullName = (app: Application) =>
  [app.firstName, app.middleName, app.lastName, app.suffix]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim() || app.name || '—';

const buildAddressText = (parts: any, fallback?: string) => {
  if (!parts || typeof parts !== 'object') return fallback || '—';

  return (
    [parts.street, parts.barangay, parts.city, parts.province, parts.region, parts.country, parts.zipCode]
      .filter(Boolean)
      .join(', ') ||
    fallback ||
    '—'
  );
};

const mapApplicantRow = (app: any): Application => {
  const customRequirements = ensureArray<{ label: string; checked: boolean }>(app.custom_requirements);
  const supportingDocuments = ensureArray<string>(app.supporting_documents);

  const mapped: Application = {
    id: app.applicant_id,
    name:
      `${app.first_name ?? ''} ${app.middle_name ?? ''} ${app.last_name ?? ''} ${app.suffix ?? ''}`
        .replace(/\s+/g, ' ')
        .trim() || app.name || '—',
    position: app.position_applied ?? '',
    dateApplied: app.created_at ?? '',
    status: (app.status ?? 'Submitted') as AppStatus,

    firstName: app.first_name ?? '',
    middleName: app.middle_name ?? '',
    lastName: app.last_name ?? '',
    suffix: app.suffix ?? '',

    gender: app.gender ?? '',
    civilStatus: app.civil_status ?? '',
    birthdate: app.birthdate ?? '',
    birthplace: app.birthplace ?? '',
    height: app.height ?? '',
    weight: app.weight ?? '',

    email: app.email ?? '',
    phone: app.phone_number ?? '',
    address: app.address ?? '',

    experience: app.experience ?? '',
    education: app.education ?? '',
    coverLetter: app.cover_letter ?? '',

    tin: app.tin ?? '',
    sss: app.sss ?? '',
    philhealth: app.philhealth ?? '',
    pagibig: app.pagibig ?? '',
    emergencyContact: app.emergency_contact ?? '',

    resumeFileName: app.resume_file_name ?? '',
    resumeFileData: app.resume_file_data ?? '',
    supportingDocuments,

    hasResume: app.has_resume ?? false,
    hasBirthCert: app.has_birth_cert ?? false,
    hasTOR: app.has_tor ?? false,
    hasMedCert: app.has_med_cert ?? false,
    requirementsNote: app.requirements_note ?? '',
    customRequirements,

    interviewDate: app.interview_date ?? '',
    interviewTime: app.interview_time ?? '',
    interviewLocation: app.interview_location ?? '',
    interviewNotes: app.interview_notes ?? '',
    interviewFeedback: app.interview_feedback ?? '',
    hiringDecision: app.hiring_decision ?? '',
    scheduledBy: app.scheduled_by ?? '',
    raw: app,
  };

  return mapped;
};

const hasOwn = (object: object, key: string) => Object.prototype.hasOwnProperty.call(object, key);

const applicationToApplicantUpdate = (update: Partial<Application>) => {
  const dbUpdate: Record<string, any> = {};

  const map: Partial<Record<keyof Application, string>> = {
    firstName: 'first_name',
    middleName: 'middle_name',
    lastName: 'last_name',
    suffix: 'suffix',
    email: 'email',
    phone: 'phone_number',
    address: 'address',
    position: 'position_applied',
    status: 'status',
    gender: 'gender',
    civilStatus: 'civil_status',
    birthdate: 'birthdate',
    birthplace: 'birthplace',
    height: 'height',
    weight: 'weight',
    education: 'education',
    experience: 'experience',
    coverLetter: 'cover_letter',
    tin: 'tin',
    sss: 'sss',
    philhealth: 'philhealth',
    pagibig: 'pagibig',
    emergencyContact: 'emergency_contact',
    resumeFileName: 'resume_file_name',
    resumeFileData: 'resume_file_data',
    supportingDocuments: 'supporting_documents',
    hasResume: 'has_resume',
    hasBirthCert: 'has_birth_cert',
    hasTOR: 'has_tor',
    hasMedCert: 'has_med_cert',
    requirementsNote: 'requirements_note',
    customRequirements: 'custom_requirements',
    interviewDate: 'interview_date',
    interviewTime: 'interview_time',
    interviewLocation: 'interview_location',
    interviewNotes: 'interview_notes',
    interviewFeedback: 'interview_feedback',
    hiringDecision: 'hiring_decision',
    scheduledBy: 'scheduled_by',
  };

  Object.entries(map).forEach(([appKey, dbKey]) => {
    const key = appKey as keyof Application;
    if (!dbKey || !hasOwn(update, key)) return;

    const value = update[key];

    if (['birthdate', 'interviewDate', 'interviewTime'].includes(key)) {
      dbUpdate[dbKey] = value || null;
    } else {
      dbUpdate[dbKey] = value;
    }
  });

  return dbUpdate;
};

const getFileTypeFromName = (name?: string) => {
  const lower = (name ?? '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (/\.(jpg|jpeg|png|gif|bmp|webp)$/.test(lower)) return `image/${lower.split('.').pop()}`;
  return '';
};

const generateTemporaryPassword = (base: string) => {
  const cleanBase = base.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'employee';

  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    window.crypto.getRandomValues(values);
    return `${cleanBase}@${values[0].toString(36).slice(0, 6)}!`;
  }

  return `${cleanBase}@${Math.random().toString(36).slice(2, 8)}!`;
};

const buildDocumentsForApplication = (app: Application | null, submittedDocuments: string[] = []): DocumentItem[] => {
  const docs: DocumentItem[] = [];

  if (!app) return docs;

  if (app.resumeFileName) {
    docs.push({
      name: app.resumeFileName,
      data: app.resumeFileData,
      type: getFileTypeFromName(app.resumeFileName),
    });
  }

  (app.supportingDocumentFiles ?? []).forEach(file => {
    docs.push({ name: file.name, data: file.data, type: file.type });
  });

  submittedDocuments.forEach(name => {
    if (!docs.some(doc => doc.name === name)) {
      docs.push({ name });
    }
  });

  return docs;
};

const getSubmittedDocumentsForApplication = (app: Application | null): string[] => {
  if (!app) return [];

  const raw = app.raw ?? {};
  const extra = safeJsonParse(app.coverLetter);

  if (Array.isArray(raw.submitted_documents) && raw.submitted_documents.length) {
    return raw.submitted_documents;
  }

  if (Array.isArray(extra.submittedDocuments) && extra.submittedDocuments.length) {
    return extra.submittedDocuments;
  }

  return app.supportingDocuments ?? [];
};

export default function RecruitmentManagement() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [viewDialog, setViewDialog] = useState(false);
  const [viewEditMode, setViewEditMode] = useState(false);
  const [interviewDialog, setInterviewDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState(0);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [loadingDocumentName, setLoadingDocumentName] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ name: string; data: string; type: string } | null>(null);

  // Interview scheduling form
  const [iForm, setIForm] = useState({
    interviewDate: '',
    interviewTime: '',
    interviewLocation: 'HR Office, Buenaventura Estate',
    interviewNotes: '',
  });

  // GM hiring decision form
  const [gmForm, setGmForm] = useState({ interviewFeedback: '', hiringDecision: '' });

  // Requirements checklist
  const [reqForm, setReqForm] = useState({
    hasResume: false,
    hasBirthCert: false,
    hasTOR: false,
    hasMedCert: false,
    requirementsNote: '',
    customRequirements: [] as { label: string; checked: boolean }[],
  });

  // Edit application
  const [editAppForm, setEditAppForm] = useState<Partial<Application>>({});

  // Edit requirements checklist dialog
  const [editReqDialog, setEditReqDialog] = useState(false);
  const [newReqText, setNewReqText] = useState('');

  const isHR = user?.role === 'hr';
  const isGM = user?.role === 'gm';

  const isRequirementsLocked =
    selectedApp?.status === 'Hired' || selectedApp?.status === 'For Interview' || selectedApp?.status === 'Not Qualified';

  const canEditRequirements = Boolean(isHR && selectedApp && !isRequirementsLocked);
  const hasLoadedApplicationsRef = useRef(false);
  const fetchRequestIdRef = useRef(0);
  const profileFetchRequestIdRef = useRef(0);
  const autoLoadedDocumentKeyRef = useRef('');
  const isMountedRef = useRef(true);

  const fetchApplications = useCallback(async (options?: { silent?: boolean }) => {
    const requestId = fetchRequestIdRef.current + 1;
    fetchRequestIdRef.current = requestId;

    const showFullLoader = !options?.silent && !hasLoadedApplicationsRef.current;

    if (showFullLoader) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError(null);

    try {
      let { data, error: fetchError } = await withTimeout(
        supabase.from('applicants').select(APPLICANT_LIST_COLUMNS).order('created_at', { ascending: true }),
        15000,
        'Loading applications took too long. Please check your connection and try again.'
      );

      // If a local database is missing one of the optional lightweight columns,
      // retry with only the table fields needed for the list before using "*".
      if (fetchError) {
        const minimalFallback = await withTimeout(
          supabase.from('applicants').select(MINIMAL_APPLICANT_LIST_COLUMNS).order('created_at', { ascending: true }),
          15000,
          'Loading applications took too long. Please check your connection and try again.'
        );

        data = minimalFallback.data;
        fetchError = minimalFallback.error;
      }

      // Last-resort compatibility fallback for older schemas.
      if (fetchError) {
        const fullFallback = await withTimeout(
          supabase.from('applicants').select('*').order('created_at', { ascending: true }),
          15000,
          'Loading applications took too long. Please check your connection and try again.'
        );
        data = fullFallback.data;
        fetchError = fullFallback.error;
      }

      if (fetchError) throw fetchError;
      if (!isMountedRef.current || fetchRequestIdRef.current !== requestId) return;

      setApplications((data ?? []).map(mapApplicantRow));
      hasLoadedApplicationsRef.current = true;
    } catch (e: any) {
      if (!isMountedRef.current || fetchRequestIdRef.current !== requestId) return;
      setError(`Could not load applications: ${e.message}`);
    } finally {
      if (!isMountedRef.current || fetchRequestIdRef.current !== requestId) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void fetchApplications();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchApplications]);

  const updateApplicantRecord = async (
    id: string,
    dbUpdate: Record<string, any>,
    localUpdate: Partial<Application>,
    message: string
  ) => {
    setSaving(true);

    try {
      const { error: updateError } = await supabase.from('applicants').update(dbUpdate).eq('applicant_id', id);

      if (updateError) throw updateError;

      setApplications(prev =>
        prev.map(app => {
          if (app.id !== id) return app;
          const updated = { ...app, ...localUpdate };
          return { ...updated, name: buildApplicantFullName(updated) };
        })
      );

      if (selectedApp?.id === id) {
        setSelectedApp(prev => {
          if (!prev) return prev;
          const updated = { ...prev, ...localUpdate };
          return { ...updated, name: buildApplicantFullName(updated) };
        });
      }

      setSnackbar({ open: true, message, severity: 'success' });
    } catch (e: any) {
      setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' });
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = (id: string, status: AppStatus) =>
    updateApplicantRecord(id, { status }, { status }, `Status updated to "${status}"!`);

  const handleSaveRequirements = async (id: string) => {
    const hasMissingStandard = !reqForm.hasResume || !reqForm.hasBirthCert || !reqForm.hasTOR || !reqForm.hasMedCert;
    const hasMissingCustom = (reqForm.customRequirements ?? []).some(item => !item.checked);
    const newStatus: AppStatus = hasMissingStandard || hasMissingCustom ? 'Missing Requirements' : 'Under Review';

    const localUpdate: Partial<Application> = {
      hasResume: reqForm.hasResume,
      hasBirthCert: reqForm.hasBirthCert,
      hasTOR: reqForm.hasTOR,
      hasMedCert: reqForm.hasMedCert,
      requirementsNote: reqForm.requirementsNote,
      customRequirements: reqForm.customRequirements,
      status: newStatus,
    };

    await updateApplicantRecord(
      id,
      applicationToApplicantUpdate(localUpdate),
      localUpdate,
      '✅ Requirements checklist saved!'
    );
  };

  const handleScheduleInterview = async () => {
    if (!selectedApp) return;

    const localUpdate: Partial<Application> = {
      status: 'For Interview',
      interviewDate: iForm.interviewDate,
      interviewTime: iForm.interviewTime,
      interviewLocation: iForm.interviewLocation,
      interviewNotes: iForm.interviewNotes,
      scheduledBy: user?.name ?? '',
    };

    await updateApplicantRecord(
      selectedApp.id,
      applicationToApplicantUpdate(localUpdate),
      localUpdate,
      '✅ Interview scheduled! Status set to "For Interview".'
    );

    setInterviewDialog(false);
  };

  const saveEditedApplication = async () => {
    if (!selectedApp) return;

    const dbUpdate = applicationToApplicantUpdate(editAppForm);

    if (Object.keys(dbUpdate).length === 0) {
      setViewEditMode(false);
      return;
    }

    await updateApplicantRecord(selectedApp.id, dbUpdate, editAppForm, 'Application updated successfully.');
    setViewEditMode(false);
  };

  const handleHiringDecision = async (id: string, decision: 'Hired' | 'Not Qualified') => {
    const status: AppStatus = decision === 'Hired' ? 'Hired' : 'Not Qualified';

    try {
      await updateApplicantRecord(
        id,
        {
          interview_feedback: gmForm.interviewFeedback,
          hiring_decision: decision,
          status,
        },
        {
          interviewFeedback: gmForm.interviewFeedback,
          hiringDecision: decision,
          status,
        },
        `✅ Hiring decision: ${status}`
      );

      if (decision !== 'Hired') {
        setViewDialog(false);
        return;
      }

      const app = applications.find(application => application.id === id) ?? selectedApp;
      if (!app) return;

      const firstName = app.firstName ?? '';
      const middleName = app.middleName ?? '';
      const lastName = app.lastName ?? '';
      const suffix = app.suffix ?? '';
      const fullName = [firstName, middleName, lastName, suffix].filter(Boolean).join(' ') || app.name;
      const loginName = `${firstName}${lastName}`.replace(/\s+/g, '').toLowerCase() || app.id.toLowerCase();

      const { data: existingEmployee, error: existingEmployeeError } = await supabase
        .from('employees')
        .select('employee_id')
        .eq('applicant_id', app.id)
        .maybeSingle();

      if (existingEmployeeError) throw existingEmployeeError;

      let employeeId = existingEmployee?.employee_id as string | undefined;

      if (!employeeId) {
        const { count: employeeCount, error: countError } = await supabase
          .from('employees')
          .select('*', { count: 'exact', head: true });

        if (countError) throw countError;
        employeeId = `EMP-2026-${String((employeeCount ?? 0) + 1).padStart(4, '0')}`;
      }

      const employeePayload = {
        employee_id: employeeId,
        applicant_id: app.id,
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        suffix,
        email: app.email ?? '',
        phone_number: app.phone ?? '',
        address: app.address ?? '',
        gender: app.gender ?? '',
        civil_status: app.civilStatus ?? '',
        birthdate: app.birthdate || null,
        birthplace: app.birthplace ?? '',
        position: app.position ?? '',
        outlet: '',
        status: 'Active',
        hire_date: new Date().toISOString().split('T')[0],
        education: app.education ?? '',
        experience: app.experience ?? '',
        tin: app.tin ?? '',
        sss: app.sss ?? '',
        philhealth: app.philhealth ?? '',
        pagibig: app.pagibig ?? '',
        emergency_contact: app.emergencyContact ?? '',
      };

      const { error: employeeSaveError } = existingEmployee
        ? await supabase.from('employees').update(employeePayload).eq('employee_id', employeeId)
        : await supabase.from('employees').insert(employeePayload);

      if (employeeSaveError) throw employeeSaveError;

      const { data: existingAccount, error: existingAccountError } = await supabase
        .from('user_accounts')
        .select('user_id')
        .eq('employee_id', employeeId)
        .maybeSingle();

      if (existingAccountError) throw existingAccountError;

      const accountPayload = {
        employee_id: employeeId,
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        full_name: fullName,
        suffix,
        email: `${loginName}@hris.com`,
        role: 'employee',
        outlet: '',
        is_active: true,
      };

      if (existingAccount?.user_id) {
        const { error: accountUpdateError } = await supabase
          .from('user_accounts')
          .update(accountPayload)
          .eq('employee_id', employeeId);

        if (accountUpdateError) throw accountUpdateError;
      } else {
        const { count: userCount, error: userCountError } = await supabase
          .from('user_accounts')
          .select('*', { count: 'exact', head: true });

        if (userCountError) throw userCountError;

        const userId = `USR-2026-${String((userCount ?? 0) + 1).padStart(4, '0')}`;
        const password = generateTemporaryPassword(loginName);

        const { error: accountInsertError } = await supabase.from('user_accounts').insert({
          user_id: userId,
          ...accountPayload,
          password,
        });

        if (accountInsertError) throw accountInsertError;

        setSnackbar({
          open: true,
          message: `✅ Applicant hired and employee account created. Temporary password: ${password}`,
          severity: 'success',
        });
      }

      setViewDialog(false);
      void fetchApplications({ silent: true });
    } catch (e: any) {
      setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Delete application ${id}? This cannot be undone.`)) return;

    try {
      const { error: deleteError } = await supabase.from('applicants').delete().eq('applicant_id', id);
      if (deleteError) throw deleteError;

      setApplications(prev => prev.filter(app => app.id !== id));
      setSnackbar({ open: true, message: 'Application deleted successfully.', severity: 'success' });
    } catch (e: any) {
      setSnackbar({ open: true, message: `Failed to delete: ${e.message}`, severity: 'error' });
    }
  };

  const setFormsFromApplication = (app: Application) => {
    setReqForm({
      hasResume: app.hasResume ?? false,
      hasBirthCert: app.hasBirthCert ?? false,
      hasTOR: app.hasTOR ?? false,
      hasMedCert: app.hasMedCert ?? false,
      requirementsNote: app.requirementsNote ?? '',
      customRequirements: app.customRequirements ?? [],
    });
    setGmForm({
      interviewFeedback: app.interviewFeedback ?? '',
      hiringDecision: app.hiringDecision ?? '',
    });
  };

  const openView = async (app: Application) => {
    const requestId = profileFetchRequestIdRef.current + 1;
    profileFetchRequestIdRef.current = requestId;

    setSelectedApp(app);
    setFormsFromApplication(app);
    setEditAppForm({});
    setViewEditMode(false);
    setDocumentsLoading(false);
    setLoadingDocumentName(null);
    setPreviewDoc(null);
    autoLoadedDocumentKeyRef.current = '';
    setViewDialog(true);
    setProfileLoading(true);

    // Let the dialog paint first before starting network work.
    // This makes the Application dialog feel instant instead of frozen.
    await waitForNextPaint();

    if (!isMountedRef.current || profileFetchRequestIdRef.current !== requestId) return;

    try {
      const { data, error: fetchError } = await withTimeout(
        supabase.from('applicants').select(APPLICANT_PROFILE_COLUMNS).eq('applicant_id', app.id).single(),
        PROFILE_DIALOG_TIMEOUT_MS,
        'Loading the application profile took too long. Basic applicant details are shown for now.'
      );

      if (fetchError) throw fetchError;
      if (!isMountedRef.current || profileFetchRequestIdRef.current !== requestId) return;

      const fullApp = mapApplicantRow(data);
      setSelectedApp(fullApp);
      setFormsFromApplication(fullApp);
    } catch (err) {
      console.warn('[RecruitmentManagement] openView profile fetch failed, using table data:', err);

      if (isMountedRef.current && profileFetchRequestIdRef.current === requestId) {
        setSnackbar({
          open: true,
          message: 'Showing basic applicant details. Full profile fields could not be loaded right now.',
          severity: 'error',
        });
      }
    } finally {
      if (!isMountedRef.current || profileFetchRequestIdRef.current !== requestId) return;
      setProfileLoading(false);
    }
  };

  const closeViewDialog = () => {
    profileFetchRequestIdRef.current += 1;
    setViewEditMode(false);
    setProfileLoading(false);
    setDocumentsLoading(false);
    setLoadingDocumentName(null);
    autoLoadedDocumentKeyRef.current = '';
    setViewDialog(false);
  };


  const tabData = useMemo(
    () => [
      { label: 'All', data: applications },
      { label: 'Submitted', data: applications.filter(a => a.status === 'Submitted') },
      { label: 'Under Review', data: applications.filter(a => a.status === 'Under Review') },
      { label: 'Missing Requirements', data: applications.filter(a => a.status === 'Missing Requirements') },
      { label: 'For Interview', data: applications.filter(a => a.status === 'For Interview') },
      { label: 'Hired', data: applications.filter(a => a.status === 'Hired') },
      { label: 'Not Qualified', data: applications.filter(a => a.status === 'Not Qualified') },
      { label: 'Not Hired', data: applications.filter(a => a.status === 'Not Hired') },
    ],
    [applications]
  );

  const displayData = tabData[tab]?.data ?? applications;

  const updateEditField = (field: keyof Application, value: any) => {
    setEditAppForm(prev => ({ ...prev, [field]: value }));
  };

  const getEditableValue = (field: keyof Application, fallback: any) => {
    const value = editAppForm[field];
    return value === undefined || value === null ? fallback ?? '' : value;
  };

  const renderProfileField = (
    label: string,
    value: any,
    size: { xs: number; sm?: number; md?: number } = { xs: 12, sm: 6 },
    field?: keyof Application,
    options?: { multiline?: boolean; rows?: number; type?: string }
  ) => {
    const editable = Boolean(viewEditMode && field);

    return (
      <Grid size={size}>
        <TextField
          fullWidth
          label={label}
          value={editable && field ? getEditableValue(field, value) : displayValue(value)}
          disabled={!editable}
          size="small"
          type={options?.type}
          multiline={options?.multiline}
          rows={options?.rows}
          InputLabelProps={options?.type === 'date' ? { shrink: true } : undefined}
          onChange={event => field && updateEditField(field, event.target.value)}
        />
      </Grid>
    );
  };

  const renderProfileSectionTitle = (title: string) => (
    <Grid size={12}>
      <Divider sx={{ my: 1 }} />
      <Typography variant="subtitle2" color="text.secondary" fontWeight={700}>
        {title}
      </Typography>
    </Grid>
  );

  const renderRequirementChecklist = () => (
    <Grid size={12}>
      <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 1 }}>
          <Box>
            <Typography fontWeight={700}>Requirements Checklist</Typography>
            <Typography variant="caption" color="text.secondary">
              HR can mark submitted requirements before interview scheduling.
            </Typography>
          </Box>

          {isHR && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<EditNote />}
              onClick={() => setEditReqDialog(true)}
              disabled={saving || Boolean(isRequirementsLocked)}
            >
              Edit Checklist
            </Button>
          )}
        </Box>

        <FormGroup>
          <Grid container spacing={1}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={reqForm.hasResume}
                    disabled={!canEditRequirements || saving}
                    onChange={event => setReqForm({ ...reqForm, hasResume: event.target.checked })}
                  />
                }
                label="Resume / CV"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={reqForm.hasBirthCert}
                    disabled={!canEditRequirements || saving}
                    onChange={event => setReqForm({ ...reqForm, hasBirthCert: event.target.checked })}
                  />
                }
                label="Birth Certificate"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={reqForm.hasTOR}
                    disabled={!canEditRequirements || saving}
                    onChange={event => setReqForm({ ...reqForm, hasTOR: event.target.checked })}
                  />
                }
                label="Transcript of Records / Diploma"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={reqForm.hasMedCert}
                    disabled={!canEditRequirements || saving}
                    onChange={event => setReqForm({ ...reqForm, hasMedCert: event.target.checked })}
                  />
                }
                label="Medical Certificate"
              />
            </Grid>
          </Grid>

          {(reqForm.customRequirements ?? []).map((customRequirement, index) => (
            <FormControlLabel
              key={`${customRequirement.label}-${index}`}
              control={
                <Checkbox
                  checked={customRequirement.checked}
                  disabled={!canEditRequirements || saving}
                  onChange={event => {
                    const updated = [...(reqForm.customRequirements ?? [])];
                    updated[index] = { ...updated[index], checked: event.target.checked };
                    setReqForm({ ...reqForm, customRequirements: updated });
                  }}
                />
              }
              label={customRequirement.label}
            />
          ))}
        </FormGroup>

        <TextField
          fullWidth
          label="Requirements Note"
          size="small"
          multiline
          rows={2}
          value={reqForm.requirementsNote}
          disabled={!canEditRequirements || saving}
          onChange={event => setReqForm({ ...reqForm, requirementsNote: event.target.value })}
          sx={{ mt: 1.5 }}
        />

        {isHR && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5 }}>
            <Button
              variant="contained"
              size="small"
              onClick={() => selectedApp && handleSaveRequirements(selectedApp.id)}
              disabled={!canEditRequirements || saving || !selectedApp}
              startIcon={saving ? <CircularProgress color="inherit" size={16} /> : <TaskAlt />}
            >
              Save Requirements
            </Button>
          </Box>
        )}
      </Paper>
    </Grid>
  );

  const autoLoadDocumentData = useCallback(async (app: Application) => {
    setDocumentsLoading(true);
    setLoadingDocumentName(null);

    // Let the dialog and document cards paint first, then load the saved base64 data automatically.
    await waitForNextPaint();

    try {
      let mergedApp = app;

      try {
        const fileData = loadApplicationFiles(app.id);
        if (fileData) {
          mergedApp = { ...mergedApp, ...fileData } as Application;
        }
      } catch (fileError) {
        console.warn('[RecruitmentManagement] Automatic local file load failed:', fileError);
      }

      const submittedDocumentNames = getSubmittedDocumentsForApplication(mergedApp);
      const docs = buildDocumentsForApplication(mergedApp, submittedDocumentNames);
      const resumeNeedsData = Boolean(
        mergedApp.resumeFileName &&
          !mergedApp.resumeFileData &&
          docs.some(document => document.name === mergedApp.resumeFileName && !document.data)
      );

      let resumeFileData = mergedApp.resumeFileData;

      if (resumeNeedsData) {
        try {
          const { data, error: resumeFetchError } = await withTimeout(
            supabase.from('applicants').select('resume_file_data').eq('applicant_id', mergedApp.id).single(),
            DOCUMENT_LOAD_TIMEOUT_MS,
            'Loading the selected document took too long. Please try again.'
          );

          if (!resumeFetchError && data?.resume_file_data) {
            resumeFileData = data.resume_file_data;
          }
        } catch (resumeError) {
          console.warn('[RecruitmentManagement] Automatic resume data fetch failed:', resumeError);
        }
      }

      if (!isMountedRef.current) return;

      setSelectedApp(prev => {
        if (!prev || prev.id !== app.id) return prev;
        return { ...prev, ...mergedApp, resumeFileData };
      });
    } finally {
      if (!isMountedRef.current) return;
      setDocumentsLoading(false);
      setLoadingDocumentName(null);
    }
  }, []);

  useEffect(() => {
    if (!viewDialog || !selectedApp || profileLoading || documentsLoading) return;

    const submittedDocumentNames = getSubmittedDocumentsForApplication(selectedApp);
    const docs = buildDocumentsForApplication(selectedApp, submittedDocumentNames);
    if (docs.length === 0 || docs.every(document => Boolean(document.data))) return;

    const documentKey = `${selectedApp.id}:${docs.map(document => document.name).join('|')}`;
    if (autoLoadedDocumentKeyRef.current === documentKey) return;

    autoLoadedDocumentKeyRef.current = documentKey;
    void autoLoadDocumentData(selectedApp);
  }, [autoLoadDocumentData, documentsLoading, profileLoading, selectedApp, viewDialog]);

  const loadDocumentDataForAction = async (doc: DocumentItem): Promise<DocumentItem | null> => {
    if (doc.data) return doc;

    if (!selectedApp) return null;

    setDocumentsLoading(true);
    setLoadingDocumentName(doc.name);

    // Give the button spinner a chance to render before reading large base64 file data.
    await waitForNextPaint();

    try {
      let mergedApp = selectedApp;

      try {
        const fileData = loadApplicationFiles(selectedApp.id);
        if (fileData) {
          mergedApp = { ...selectedApp, ...fileData } as Application;
          setSelectedApp(mergedApp);
        }
      } catch (fileError) {
        console.warn('[RecruitmentManagement] Local file load failed:', fileError);
      }

      const submittedDocumentNames = getSubmittedDocumentsForApplication(mergedApp);

      let loadedDoc = buildDocumentsForApplication(mergedApp, submittedDocumentNames).find(
        item => item.name === doc.name && Boolean(item.data)
      );

      // Manual fallback: if automatic loading has not completed yet, fetch the resume data here.
      if (!loadedDoc?.data && mergedApp.resumeFileName === doc.name) {
        try {
          const { data, error: resumeFetchError } = await withTimeout(
            supabase.from('applicants').select('resume_file_data').eq('applicant_id', mergedApp.id).single(),
            DOCUMENT_LOAD_TIMEOUT_MS,
            'Loading the selected document took too long. Please try again.'
          );

          if (!resumeFetchError && data?.resume_file_data) {
            loadedDoc = { ...doc, data: data.resume_file_data, type: doc.type || getFileTypeFromName(doc.name) };
            setSelectedApp(prev =>
              prev?.id === mergedApp.id ? { ...prev, resumeFileData: data.resume_file_data } : prev
            );
          }
        } catch (resumeError) {
          console.warn('[RecruitmentManagement] Resume data fetch failed:', resumeError);
        }
      }

      if (!loadedDoc?.data) {
        setSnackbar({
          open: true,
          message: 'File data is not available for this document. Only the filename was saved.',
          severity: 'error',
        });
        return null;
      }

      return loadedDoc;
    } finally {
      setDocumentsLoading(false);
      setLoadingDocumentName(null);
    }
  };

  const handlePreviewDocument = async (doc: DocumentItem) => {
    const documentToPreview = await loadDocumentDataForAction(doc);
    if (!documentToPreview?.data) return;

    setPreviewDoc({
      name: documentToPreview.name,
      data: documentToPreview.data,
      type: documentToPreview.type || getFileTypeFromName(documentToPreview.name),
    });
  };

  const handleDownloadDocument = async (doc: DocumentItem) => {
    const documentToDownload = await loadDocumentDataForAction(doc);
    if (!documentToDownload?.data) return;

    downloadFile(documentToDownload.data, documentToDownload.name);
  };

  const renderDocumentCard = (doc: DocumentItem, index: number) => {
    const type = doc.type || getFileTypeFromName(doc.name);
    const hasData = Boolean(doc.data);
    const isLoadingThisDocument = documentsLoading && (!loadingDocumentName || loadingDocumentName === doc.name);

    return (
      <Grid key={`${doc.name}-${index}`} size={{ xs: 12, sm: 6 }}>
        <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DocIcon name={doc.name} type={type} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography fontWeight={600} noWrap>
                {doc.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {hasData
                  ? 'File ready for preview and download'
                  : documentsLoading
                    ? 'Loading file data automatically…'
                    : 'File data will load automatically when the application opens'}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={isLoadingThisDocument ? <CircularProgress color="inherit" size={14} /> : <Visibility />}
              disabled={documentsLoading}
              onClick={() => handlePreviewDocument({ ...doc, type })}
            >
              {isLoadingThisDocument ? 'Loading…' : 'Preview'}
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={isLoadingThisDocument ? <CircularProgress color="inherit" size={14} /> : <FileDownload />}
              disabled={documentsLoading}
              onClick={() => handleDownloadDocument({ ...doc, type })}
            >
              {isLoadingThisDocument ? 'Loading…' : 'Download'}
            </Button>
          </Box>
        </Paper>
      </Grid>
    );
  };

  const renderDocumentsSection = (submittedDocuments: string[]) => {
    const docs = buildDocumentsForApplication(selectedApp, submittedDocuments);

    return (
      <>
        {renderProfileSectionTitle('VII. DOCUMENTS')}
        {renderProfileField('Resume / Biodata', selectedApp?.resumeFileName ? `Uploaded: ${selectedApp.resumeFileName}` : selectedApp?.hasResume ? 'Submitted' : 'Not Submitted')}
        {renderProfileField('Birth Certificate', selectedApp?.hasBirthCert ? 'Submitted' : 'Not Submitted')}
        {renderProfileField('Transcript of Records / Diploma', selectedApp?.hasTOR ? 'Submitted' : 'Not Submitted')}
        {renderProfileField('Medical Certificate', selectedApp?.hasMedCert ? 'Submitted' : 'Not Submitted')}
        {renderProfileField('Submitted Documents', submittedDocuments, { xs: 12 })}

        <Grid size={12}>
          <Grid container spacing={1.5}>
            {documentsLoading && (
              <Grid size={12}>
                <LinearProgress sx={{ mb: 0.75 }} />
                <Typography variant="caption" color="text.secondary">
                  Loading document data automatically…
                </Typography>
              </Grid>
            )}

            {docs.length > 0 ? (
              docs.map(renderDocumentCard)
            ) : (
              <Grid size={12}>
                <Alert severity="info">No document filenames were found for this application yet.</Alert>
              </Grid>
            )}
          </Grid>
        </Grid>
      </>
    );
  };

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexWrap: 'wrap',
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            gutterBottom
            fontWeight="bold"
            sx={{ fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2.125rem' } }}
          >
            Recruitment & Application Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isHR
              ? 'Review applications, check requirements, and schedule interviews'
              : isGM
                ? 'Conduct interviews and input final hiring decisions'
                : 'View job applications'}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <span>
              <IconButton onClick={() => fetchApplications({ silent: true })} disabled={loading || refreshing}>
                {refreshing ? <CircularProgress size={20} /> : <Sync />}
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" onClick={() => fetchApplications()}>Retry</Button>}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto">
          {tabData.map((tabItem, index) => (
            <Tab key={tabItem.label} label={`${tabItem.label} (${tabItem.data.length})`} value={index} />
          ))}
        </Tabs>
      </Paper>

      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        {refreshing && !loading && <LinearProgress />}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6, gap: 2 }}>
            <CircularProgress size={28} />
            <Typography color="text.secondary">Loading…</Typography>
          </Box>
        ) : (
          <Table sx={{ minWidth: 750 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>App ID</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>Applicant Name</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>Position</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>Date Applied</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>Interview Date</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>Status</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 140 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                    No applications in this category.
                  </TableCell>
                </TableRow>
              ) : (
                displayData.map(app => (
                  <TableRow key={app.id} hover>
                    <TableCell>
                      <Chip label={app.id} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{app.name}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{app.position}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(app.dateApplied)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {formatInterviewDateTime(app.interviewDate, app.interviewTime)}
                    </TableCell>
                    <TableCell>
                      <Chip label={app.status} color={STATUS_COLORS[app.status] ?? 'default'} size="small" sx={{ whiteSpace: 'nowrap' }} />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
                        <Chip
                          label="View Profile"
                          size="small"
                          clickable
                          variant="outlined"
                          color="primary"
                          onClick={() => openView(app)}
                          sx={{ minWidth: 110 }}
                        />
                        {isGM && app.status === 'For Interview' && (
                          <Chip
                            label="Hiring Decision"
                            size="small"
                            clickable
                            variant="outlined"
                            color="success"
                            onClick={() => openView(app)}
                            sx={{ minWidth: 110 }}
                          />
                        )}
                        {(isHR || isGM) && (
                          <Chip
                            label="Delete"
                            size="small"
                            clickable
                            variant="outlined"
                            color="error"
                            onClick={() => handleDelete(app.id)}
                            sx={{ minWidth: 110 }}
                          />
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      <Dialog
        open={viewDialog}
        onClose={closeViewDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle fontWeight={700}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <span>Application — {selectedApp?.id}</span>
            {selectedApp && <Chip label={selectedApp.status} color={STATUS_COLORS[selectedApp.status] ?? 'default'} />}
          </Box>
        </DialogTitle>

        <DialogContent>
          {profileLoading && (
            <Box sx={{ mb: 2 }}>
              <LinearProgress sx={{ mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Basic details are shown first while the full application profile loads…
              </Typography>
            </Box>
          )}

          {selectedApp &&
            (() => {
              const raw = selectedApp.raw ?? {};
              const extra = safeJsonParse(selectedApp.coverLetter);

              const educationBackground =
                extra.educationBackground ?? extra.educationalBackground ?? raw.educational_background ?? {};

              const workExperience = extra.workExperience ?? raw.work_experience ?? {};

              const skills =
                Array.isArray(raw.skills) && raw.skills.length
                  ? raw.skills
                  : Array.isArray(extra.skills)
                    ? extra.skills
                    : [];

              const certifications =
                Array.isArray(raw.certifications) && raw.certifications.length
                  ? raw.certifications
                  : Array.isArray(extra.certifications)
                    ? extra.certifications
                    : [];

              const characterReferences =
                Array.isArray(raw.character_references) && raw.character_references.length
                  ? raw.character_references
                  : Array.isArray(extra.characterReferences)
                    ? extra.characterReferences
                    : raw.reference_name
                      ? [
                          {
                            name: raw.reference_name,
                            position: raw.reference_position,
                            company: raw.reference_company,
                            contact: raw.reference_contact,
                          },
                        ]
                      : [];

              const emergencyContact =
                extra.emergencyContact ??
                (raw.emergency_contact_name || raw.emergency_contact_phone
                  ? {
                      name: raw.emergency_contact_name,
                      relation: raw.emergency_contact_relation,
                      phone: raw.emergency_contact_phone,
                      address: raw.emergency_contact_address,
                    }
                  : {});

              const submittedDocuments = getSubmittedDocumentsForApplication(selectedApp);

              const currentAddress =
                raw.current_address ?? extra.currentAddress ?? buildAddressText(extra.currentAddressParts, selectedApp.address);

              const permanentAddress =
                raw.permanent_address ?? extra.permanentAddress ?? buildAddressText(extra.permanentAddressParts);

              return (
                <Grid container spacing={2} sx={{ pt: 1 }}>
                  {renderProfileSectionTitle('I. POSITION APPLIED FOR')}
                  {renderProfileField('Position Applied For', selectedApp.position, { xs: 12, sm: 6 }, 'position')}
                  {renderProfileField('How did you hear about this job opening?', raw.hear_about ?? extra.hearAbout)}
                  {(raw.hear_about_other || extra.hearAboutOther) &&
                    renderProfileField('Other Source', raw.hear_about_other ?? extra.hearAboutOther, { xs: 12 })}

                  {renderProfileSectionTitle('II. PERSONAL DETAILS')}
                  {renderProfileField('First Name', selectedApp.firstName, { xs: 12, sm: 6 }, 'firstName')}
                  {renderProfileField('Middle Name', selectedApp.middleName, { xs: 12, sm: 6 }, 'middleName')}
                  {renderProfileField('Last Name', selectedApp.lastName, { xs: 12, sm: 6 }, 'lastName')}
                  {renderProfileField('Suffix', selectedApp.suffix, { xs: 12, sm: 6 }, 'suffix')}
                  {renderProfileField('Full Name', buildApplicantFullName({ ...selectedApp, ...editAppForm }), { xs: 12 })}
                  {renderProfileField('Date of Birth', selectedApp.birthdate, { xs: 12, sm: 6 }, 'birthdate', { type: 'date' })}
                  {renderProfileField('Age', raw.age ?? extra.age)}
                  {renderProfileField('Gender', selectedApp.gender, { xs: 12, sm: 6 }, 'gender')}
                  {renderProfileField('Civil Status', selectedApp.civilStatus, { xs: 12, sm: 6 }, 'civilStatus')}
                  {renderProfileField('Nationality', raw.nationality ?? extra.nationality)}
                  {renderProfileField('Birthplace', selectedApp.birthplace, { xs: 12, sm: 6 }, 'birthplace')}
                  {renderProfileField('Height', selectedApp.height, { xs: 12, sm: 6 }, 'height')}
                  {renderProfileField('Weight', selectedApp.weight, { xs: 12, sm: 6 }, 'weight')}
                  {renderProfileField('Contact Number', selectedApp.phone, { xs: 12, sm: 6 }, 'phone')}
                  {renderProfileField('Email Address', selectedApp.email, { xs: 12, sm: 6 }, 'email')}
                  {renderProfileField('Current Address', currentAddress, { xs: 12 }, 'address', { multiline: true, rows: 2 })}
                  {renderProfileField('Permanent Address', permanentAddress, { xs: 12 })}

                  {renderProfileSectionTitle('III. EDUCATIONAL BACKGROUND and IV. WORK EXPERIENCE')}
                  {renderProfileField('Educational Level', selectedApp.education ?? educationBackground.level, { xs: 12, sm: 6 }, 'education')}
                  {renderProfileField('Name of School', raw.school_name ?? educationBackground.schoolName)}
                  {renderProfileField('Course / Program', raw.course_program ?? educationBackground.courseProgram)}
                  {renderProfileField('Year Graduated', raw.year_graduated ?? educationBackground.yearGraduated)}
                  {renderProfileField('Honors / Awards', raw.honors_awards ?? educationBackground.honorsAwards, { xs: 12 })}
                  {renderProfileField('Total Years of Experience', selectedApp.experience ?? workExperience.totalYearsExperience, { xs: 12, sm: 6 }, 'experience')}
                  {renderProfileField('Company / Organization', raw.company_organization ?? workExperience.companyOrganization)}
                  {renderProfileField('Position Held', raw.position_held ?? workExperience.positionHeld)}
                  {renderProfileField('Employment Period', raw.employment_period ?? workExperience.employmentPeriod)}
                  {renderProfileField('Previous Supervisor / Manager', raw.previous_supervisor ?? workExperience.previousSupervisor)}
                  {renderProfileField('Supervisor Contact Number / Email', raw.supervisor_contact ?? workExperience.supervisorContact)}
                  {renderProfileField('Duties / Responsibilities', raw.duties_responsibilities ?? workExperience.dutiesResponsibilities, { xs: 12 })}
                  {renderProfileField('Reason for Leaving', raw.reason_for_leaving ?? workExperience.reasonForLeaving, { xs: 12 })}

                  {renderProfileSectionTitle('V. SKILLS AND QUALIFICATIONS')}
                  {renderProfileField('Skills', skills, { xs: 12 })}
                  {renderProfileField('Other Skills', raw.other_skills ?? extra.otherSkills, { xs: 12 })}
                  {renderProfileField('Certifications / Trainings', certifications, { xs: 12 })}

                  {renderProfileSectionTitle('VI. GOVERNMENT IDS, CHARACTER REFERENCES, and EMERGENCY CONTACT')}
                  {renderProfileField('TIN', selectedApp.tin, { xs: 12, sm: 6 }, 'tin')}
                  {renderProfileField('SSS', selectedApp.sss, { xs: 12, sm: 6 }, 'sss')}
                  {renderProfileField('PhilHealth', selectedApp.philhealth, { xs: 12, sm: 6 }, 'philhealth')}
                  {renderProfileField('Pag-IBIG', selectedApp.pagibig, { xs: 12, sm: 6 }, 'pagibig')}

                  {characterReferences.length > 0 ? (
                    characterReferences.map((reference: any, index: number) => (
                      <Grid key={`reference-${index}`} size={12}>
                        <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                          <Typography fontWeight={700} sx={{ mb: 1 }}>
                            Character Reference {index + 1}
                          </Typography>
                          <Grid container spacing={2}>
                            {renderProfileField('Name', reference.name)}
                            {renderProfileField('Position / Relationship', reference.position)}
                            {renderProfileField('Company / Organization', reference.company)}
                            {renderProfileField('Contact Number', reference.contact)}
                          </Grid>
                        </Paper>
                      </Grid>
                    ))
                  ) : (
                    renderProfileField('Character References', '—', { xs: 12 })
                  )}

                  {renderProfileField('Emergency Contact Person', emergencyContact.name ?? selectedApp.emergencyContact, { xs: 12, sm: 6 }, 'emergencyContact')}
                  {renderProfileField('Relationship', emergencyContact.relation)}
                  {renderProfileField('Contact Number', emergencyContact.phone)}
                  {renderProfileField('Address', emergencyContact.address, { xs: 12 })}

                  {renderDocumentsSection(submittedDocuments)}

                  {renderProfileSectionTitle('VIII. APPLICANT DECLARATION')}
                  {renderProfileField('Applicant Signature / Full Name', raw.applicant_signature ?? extra.applicantSignature)}
                  {renderProfileField('Declaration Date', raw.declaration_date ?? extra.declarationDate)}

                  {renderProfileSectionTitle('IX. HR REQUIREMENTS VALIDATION')}
                  {renderRequirementChecklist()}

                  {selectedApp.status === 'For Interview' && (
                    <>
                      {renderProfileSectionTitle('X. INTERVIEW DETAILS')}
                      {renderProfileField('Interview Date', selectedApp.interviewDate, { xs: 12, sm: 6 })}
                      {renderProfileField('Interview Time', selectedApp.interviewTime, { xs: 12, sm: 6 })}
                      {renderProfileField('Interview Location', selectedApp.interviewLocation, { xs: 12 })}
                      {renderProfileField('Interview Notes', selectedApp.interviewNotes, { xs: 12 })}
                      {renderProfileField('Scheduled By', selectedApp.scheduledBy)}
                    </>
                  )}

                  {isGM && selectedApp.status === 'For Interview' && (
                    <>
                      {renderProfileSectionTitle('XI. GM INTERVIEW FEEDBACK')}
                      <Grid size={12}>
                        <TextField
                          fullWidth
                          label="Interview Feedback / Remarks"
                          multiline
                          rows={4}
                          value={gmForm.interviewFeedback}
                          onChange={event => setGmForm({ ...gmForm, interviewFeedback: event.target.value })}
                          disabled={saving}
                        />
                      </Grid>
                    </>
                  )}
                </Grid>
              );
            })()}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: 'wrap' }}>
          {selectedApp && (isHR || isGM) && (
            <TextField
              select
              size="small"
              variant="standard"
              label="Status Update"
              value={selectedApp.status}
              onChange={event => handleUpdateStatus(selectedApp.id, event.target.value as AppStatus)}
              disabled={saving}
              sx={{ minWidth: 190, mr: 'auto' }}
            >
              {ALL_STATUSES.map(status => (
                <MenuItem key={status} value={status}>
                  {status}
                </MenuItem>
              ))}
            </TextField>
          )}
          {selectedApp && (isHR || isGM) && (
            <Button
              variant={viewEditMode ? 'contained' : 'outlined'}
              onClick={async () => {
                if (!viewEditMode) {
                  setEditAppForm(selectedApp);
                  setViewEditMode(true);
                  return;
                }

                await saveEditedApplication();
              }}
              disabled={saving}
            >
              {viewEditMode ? 'Save Changes' : 'Edit Profile'}
            </Button>
          )}

          {viewEditMode && (
            <Button
              onClick={() => {
                setEditAppForm({});
                setViewEditMode(false);
              }}
              disabled={saving}
            >
              Cancel Edit
            </Button>
          )}

          <Button onClick={closeViewDialog}>Close</Button>

          {isHR && selectedApp?.status === 'For Interview' && (
              <Button
                variant="outlined"
                color="info"
                startIcon={<CalendarMonth />}
                disabled={saving}
                onClick={() => {
                  setInterviewDialog(true);
                  setIForm({
                    interviewDate: selectedApp.interviewDate ?? '',
                    interviewTime: selectedApp.interviewTime ?? '',
                    interviewLocation: selectedApp.interviewLocation ?? 'HR Office, Buenaventura Estate',
                    interviewNotes: selectedApp.interviewNotes ?? '',
                  });
                }}
              >
                {selectedApp.interviewDate ? 'Update Interview' : 'Schedule Interview'}
              </Button>
            )}

          {isGM && selectedApp?.status === 'For Interview' && (
            <>
              <Button
                variant="outlined"
                color="error"
                startIcon={<CancelOutlined />}
                onClick={() => handleHiringDecision(selectedApp.id, 'Not Qualified')}
                disabled={saving}
              >
                Not Qualified
              </Button>
              <Button
                variant="contained"
                color="success"
                startIcon={<TaskAlt />}
                onClick={() => handleHiringDecision(selectedApp.id, 'Hired')}
                disabled={saving}
              >
                Hire Applicant
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { height: '90vh', display: 'flex', flexDirection: 'column' } }}
      >
        <DialogTitle
          fontWeight={700}
          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1, gap: 1 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            {previewDoc && <DocIcon name={previewDoc.name} type={previewDoc.type} />}
            <Typography fontWeight={700} noWrap sx={{ flex: 1 }}>
              {previewDoc?.name}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<FileDownload />}
            onClick={() => previewDoc && downloadFile(previewDoc.data, previewDoc.name)}
            sx={{ flexShrink: 0 }}
          >
            Download
          </Button>
        </DialogTitle>
        <DialogContent sx={{ flex: 1, overflow: 'hidden', p: 1, display: 'flex', flexDirection: 'column' }}>
          {previewDoc &&
            (() => {
              const isPdf = previewDoc.type === 'application/pdf' || previewDoc.name.toLowerCase().endsWith('.pdf');
              const isImage =
                previewDoc.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(previewDoc.name);

              if (isPdf) {
                return (
                  <iframe
                    src={previewDoc.data}
                    title={previewDoc.name}
                    style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8, flex: 1 }}
                  />
                );
              }

              if (isImage) {
                return (
                  <Box
                    sx={{
                      flex: 1,
                      overflow: 'auto',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: '#f0f0f0',
                      borderRadius: 2,
                    }}
                  >
                    <img
                      src={previewDoc.data}
                      alt={previewDoc.name}
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        borderRadius: 4,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                      }}
                    />
                  </Box>
                );
              }

              return (
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  <InsertDriveFile sx={{ fontSize: 72, color: 'text.disabled' }} />
                  <Typography variant="h6" color="text.secondary">
                    Preview not available for this file type
                  </Typography>
                  <Typography variant="body2" color="text.disabled">
                    ({previewDoc.type || 'unknown type'})
                  </Typography>
                  <Button variant="contained" startIcon={<FileDownload />} onClick={() => downloadFile(previewDoc.data, previewDoc.name)}>
                    Download to view
                  </Button>
                </Box>
              );
            })()}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPreviewDoc(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={interviewDialog} onClose={() => setInterviewDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Event color="info" /> Schedule Interview — {selectedApp?.name}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Interview Date"
                type="date"
                value={iForm.interviewDate}
                onChange={event => setIForm({ ...iForm, interviewDate: event.target.value })}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Interview Time"
                type="time"
                value={iForm.interviewTime}
                onChange={event => setIForm({ ...iForm, interviewTime: event.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Interview Location"
                value={iForm.interviewLocation}
                onChange={event => setIForm({ ...iForm, interviewLocation: event.target.value })}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Interview Notes / Instructions for Applicant"
                value={iForm.interviewNotes}
                onChange={event => setIForm({ ...iForm, interviewNotes: event.target.value })}
                placeholder="e.g. Please bring original documents and 2 valid IDs."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setInterviewDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="info"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <CalendarMonth />}
            onClick={handleScheduleInterview}
            disabled={saving || !iForm.interviewDate}
          >
            {saving ? 'Saving…' : 'Confirm Interview Schedule'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editReqDialog} onClose={() => setEditReqDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EditNote color="primary" /> Edit Requirements Checklist
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Standard requirements are fixed. You may add custom requirements below.
          </Typography>

          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.5 }}>
            STANDARD REQUIREMENTS
          </Typography>
          <Box sx={{ mb: 2 }}>
            {['Resume / CV', 'Birth Certificate', 'Transcript of Records (TOR)', 'Medical Certificate'].map(label => (
              <Chip key={label} label={label} size="small" variant="outlined" sx={{ mr: 0.5, mb: 0.5 }} />
            ))}
          </Box>

          <Divider sx={{ mb: 2 }} />

          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.5 }}>
            CUSTOM REQUIREMENTS
          </Typography>
          <Box sx={{ mb: 2, mt: 1 }}>
            {(reqForm.customRequirements ?? []).length === 0 ? (
              <Typography variant="caption" color="text.disabled">
                No custom requirements added yet.
              </Typography>
            ) : (
              (reqForm.customRequirements ?? []).map((customRequirement, index) => (
                <Box key={`${customRequirement.label}-${index}`} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Chip label={customRequirement.label} size="small" variant="outlined" color="info" />
                  <Tooltip title="Remove">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => {
                        const updated = reqForm.customRequirements.filter((_, itemIndex) => itemIndex !== index);
                        setReqForm({ ...reqForm, customRequirements: updated });
                      }}
                    >
                      <RemoveCircle fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              ))
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <TextField
              fullWidth
              size="small"
              label="New Requirement"
              placeholder="e.g. NBI Clearance, Police Clearance, etc."
              value={newReqText}
              onChange={event => setNewReqText(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && newReqText.trim()) {
                  setReqForm({
                    ...reqForm,
                    customRequirements: [...(reqForm.customRequirements ?? []), { label: newReqText.trim(), checked: false }],
                  });
                  setNewReqText('');
                }
              }}
            />
            <Button
              variant="contained"
              startIcon={<AddCircle />}
              disabled={!newReqText.trim()}
              onClick={() => {
                setReqForm({
                  ...reqForm,
                  customRequirements: [...(reqForm.customRequirements ?? []), { label: newReqText.trim(), checked: false }],
                });
                setNewReqText('');
              }}
              sx={{ flexShrink: 0 }}
            >
              Add
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditReqDialog(false)}>Close</Button>
          <Button variant="contained" onClick={() => setEditReqDialog(false)}>
            Done
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar(state => ({ ...state, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(state => ({ ...state, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

/** Download a base64 data URI as a file */
function downloadFile(dataUri: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUri;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function DocIcon({ name, type }: { name: string; type?: string }) {
  const lowerName = name.toLowerCase();

  if (type === 'application/pdf' || lowerName.endsWith('.pdf')) {
    return <PictureAsPdf fontSize="small" sx={{ color: '#E53935' }} />;
  }

  if ((type ?? '').includes('word') || lowerName.endsWith('.doc') || lowerName.endsWith('.docx')) {
    return <Article fontSize="small" sx={{ color: '#1565C0' }} />;
  }

  if ((type ?? '').startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(name)) {
    return <ImageIcon fontSize="small" sx={{ color: '#7B1FA2' }} />;
  }

  return <InsertDriveFile fontSize="small" sx={{ color: '#546E7A' }} />;
}
