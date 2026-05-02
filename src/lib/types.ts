export interface HumorFlavor {
  id: number
  created_datetime_utc: string
  description: string
  slug: string
  created_by_user_id: string
  modified_by_user_id: string | null
  modified_datetime_utc: string | null
}

export interface HumorFlavorStep {
  id: number
  created_datetime_utc: string
  humor_flavor_id: number
  llm_temperature: number | null
  order_by: number
  llm_input_type_id: number | null
  llm_output_type_id: number | null
  llm_model_id: number | null
  humor_flavor_step_type_id: number | null
  llm_system_prompt: string | null
  llm_user_prompt: string | null
  description: string | null
  created_by_user_id: string
  modified_by_user_id: string | null
  modified_datetime_utc: string | null
}

export interface HumorFlavorStepType {
  id: number
  created_at: string
  slug: string
  description: string | null
  created_by_user_id: string
  modified_by_user_id: string | null
  created_datetime_utc: string | null
  modified_datetime_utc: string | null
}

export interface LlmInputType {
  id: number
  slug: string
}

export interface LlmOutputType {
  id: number
  slug: string
}

export interface LlmModel {
  id: number
  name: string
}

export interface Profile {
  id: string
  is_superadmin: boolean
  is_matrix_admin: boolean
  email?: string
}