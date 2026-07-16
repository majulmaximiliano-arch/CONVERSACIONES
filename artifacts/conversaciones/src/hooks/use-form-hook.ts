import * as React from "react"
import { useForm, UseFormReturn, FieldValues, UseFormProps } from "react-hook-form"

// Wrapper to standardise form hook
export function useFormHook<TFieldValues extends FieldValues = FieldValues, TContext = any>(
  props?: UseFormProps<TFieldValues, TContext>
): UseFormReturn<TFieldValues, TContext> {
  return useForm<TFieldValues, TContext>(props)
}
