import { projectId, publicAnonKey } from "../../utils/supabase/info";
export const API = `https://${projectId}.supabase.co/functions/v1/make-server-24f1182d`;
export const HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${publicAnonKey}`,
};
