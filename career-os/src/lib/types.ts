export type EducationEntry = {
  school: string;
  degree: string;
  field: string;
  start_date: string;
  end_date: string;
  gpa: string;
  notes: string;
};

export type WorkHistoryEntry = {
  company: string;
  title: string;
  start_date: string;
  end_date: string;
  current: boolean;
  description: string;
  achievements: string[];
};

export type SkillEntry = {
  name: string;
  category: string;
  level: string;
};

export type CertificationEntry = {
  name: string;
  issuer: string;
  date: string;
  credential_url: string;
};

export type Profile = {
  id?: string;
  user_id?: string;
  full_name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  linkedin_url: string;
  github_url: string;
  summary: string;
  education: EducationEntry[];
  work_history: WorkHistoryEntry[];
  skills: SkillEntry[];
  certifications: CertificationEntry[];
  languages: string[];
  updated_at?: string;
};

export const emptyProfile: Profile = {
  full_name: '',
  headline: '',
  email: '',
  phone: '',
  location: '',
  website: '',
  linkedin_url: '',
  github_url: '',
  summary: '',
  education: [],
  work_history: [],
  skills: [],
  certifications: [],
  languages: [],
};

export type GapAnalysis = {
  matched_skills: string[];
  missing_skills: string[];
  notes: string;
};

export type Opportunity = {
  id: string;
  title: string;
  org_name: string;
  opportunity_type: 'job' | 'internship' | 'scholarship' | 'grant' | 'other';
  source_url: string;
  deadline: string | null;
  location: string;
  remote: boolean;
  status: 'saved' | 'researching' | 'drafting' | 'applied' | 'interview' | 'offer' | 'rejected' | 'withdrawn';
  fetched_content: string;
  gap_analysis: Partial<GapAnalysis>;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type DocumentRow = {
  id: string;
  source: 'upload' | 'onedrive' | 'googledrive';
  file_name: string;
  mime_type: string;
  storage_path: string;
  extraction_status: 'pending' | 'ok' | 'failed' | 'unsupported';
  doc_type: 'cv' | 'transcript' | 'certificate' | 'id' | 'cover_letter' | 'recommendation' | 'other';
  size_bytes: number;
  created_at: string;
};
