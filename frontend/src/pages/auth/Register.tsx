import { zodResolver } from '@hookform/resolvers/zod'
import type { AxiosError } from 'axios'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Controller, useForm, type FieldErrors, type Path, type UseFormRegister } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import type { z } from 'zod'

import { authApi } from '@/api/auth.api'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  adminRegisterSchema,
  bulkBuyerRegisterSchema,
  consumerRegisterSchema,
  farmerRegisterSchema,
  logisticsRegisterSchema,
} from '@/lib/validators/auth.validators'
import type { UserRole } from '@/types/auth.types'

const ROLE_META: Record<UserRole, { emoji: string; label: string }> = {
  FARMER: { emoji: '🌾', label: 'Farmer / FPO' },
  CONSUMER: { emoji: '🛒', label: 'Consumer' },
  BULK_BUYER: { emoji: '🏢', label: 'Bulk Buyer' },
  LOGISTICS: { emoji: '🚚', label: 'Logistics' },
  ADMIN: { emoji: '🏛️', label: 'Government / Admin' },
}

const CROPS = ['TURMERIC', 'MUSTARD', 'HONEY', 'WHEAT', 'RICE', 'COTTON', 'SUGARCANE', 'OTHER']

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-danger">{message}</p>
}

interface CommonRegisterFields {
  full_name: string
  phone: string
  password: string
}

function CommonFields<T extends CommonRegisterFields>({
  register,
  errors,
}: {
  register: UseFormRegister<T>
  errors: FieldErrors<T>
}) {
  return (
    <>
      <div>
        <Label htmlFor="full_name">Full Name</Label>
        <Input id="full_name" {...register('full_name' as Path<T>)} className="mt-1.5" />
        <FieldError message={errors.full_name?.message as string} />
      </div>
      <div>
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" type="tel" maxLength={10} {...register('phone' as Path<T>)} className="mt-1.5" />
        <FieldError message={errors.phone?.message as string} />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" {...register('password' as Path<T>)} className="mt-1.5" />
        <FieldError message={errors.password?.message as string} />
      </div>
    </>
  )
}

function useRegisterSubmit() {
  const navigate = useNavigate()
  return useMutation({
    // The backend's Zod schema treats email as either a valid address or entirely absent --
    // it does not accept an empty string, which is what an untouched optional field submits as.
    mutationFn: (data: Parameters<typeof authApi.register>[0]) =>
      authApi.register(data.email ? data : { ...data, email: undefined }),
    onSuccess: (res, variables) => {
      toast.success(res.message ?? 'OTP sent to your phone.')
      navigate('/verify-otp', { state: { phone: variables.phone, devOtp: res.data.devOtp, purpose: 'registration' } })
    },
    onError: (err: AxiosError<{ error?: { message?: string } }>) => {
      toast.error(err.response?.data?.error?.message ?? 'Registration failed. Please try again.')
    },
  })
}

type FarmerFields = z.infer<typeof farmerRegisterSchema>

function FarmerForm() {
  const { register, handleSubmit, control, formState: { errors } } = useForm<FarmerFields>({
    resolver: zodResolver(farmerRegisterSchema),
    defaultValues: { role: 'FARMER', primary_crop_types: [] },
  })
  const mutation = useRegisterSubmit()

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit((data) => mutation.mutate(data))}>
      <CommonFields register={register} errors={errors} />
      <div>
        <Label htmlFor="email">Email (optional)</Label>
        <Input id="email" type="email" {...register('email')} className="mt-1.5" />
        <FieldError message={errors.email?.message as string} />
      </div>
      <div>
        <Label htmlFor="fpo_name">FPO Name</Label>
        <Input id="fpo_name" {...register('fpo_name')} className="mt-1.5" />
        <FieldError message={errors.fpo_name?.message as string} />
      </div>
      <div>
        <Label htmlFor="registration_number">FPO Registration Number</Label>
        <Input id="registration_number" {...register('registration_number')} className="mt-1.5" />
        <FieldError message={errors.registration_number?.message as string} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="state">State</Label>
          <Input id="state" {...register('state')} className="mt-1.5" />
          <FieldError message={errors.state?.message as string} />
        </div>
        <div>
          <Label htmlFor="district">District</Label>
          <Input id="district" {...register('district')} className="mt-1.5" />
          <FieldError message={errors.district?.message as string} />
        </div>
      </div>
      <div>
        <Label>Primary Crop</Label>
        <Controller
          control={control}
          name="primary_crop_types"
          render={({ field }) => (
            <Select value={field.value?.[0]} onValueChange={(v) => field.onChange([v])}>
              <SelectTrigger className="mt-1.5 w-full">
                <SelectValue placeholder="Select a crop" />
              </SelectTrigger>
              <SelectContent>
                {CROPS.map((crop) => (
                  <SelectItem key={crop} value={crop}>
                    {crop}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError message={errors.primary_crop_types?.message as string} />
      </div>
      <Button type="submit" size="lg" disabled={mutation.isPending} className="mt-2">
        {mutation.isPending ? 'Creating account...' : 'Create Account'}
      </Button>
    </form>
  )
}

type ConsumerFields = z.infer<typeof consumerRegisterSchema>

function ConsumerForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<ConsumerFields>({
    resolver: zodResolver(consumerRegisterSchema),
    defaultValues: { role: 'CONSUMER' },
  })
  const mutation = useRegisterSubmit()

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit((data) => mutation.mutate(data))}>
      <CommonFields register={register} errors={errors} />
      <div>
        <Label htmlFor="email">Email (optional)</Label>
        <Input id="email" type="email" {...register('email')} className="mt-1.5" />
        <FieldError message={errors.email?.message as string} />
      </div>
      <div>
        <Label htmlFor="delivery_pincode">Delivery Pincode</Label>
        <Input id="delivery_pincode" maxLength={6} {...register('delivery_pincode')} className="mt-1.5" />
        <FieldError message={errors.delivery_pincode?.message as string} />
      </div>
      <Button type="submit" size="lg" disabled={mutation.isPending} className="mt-2">
        {mutation.isPending ? 'Creating account...' : 'Create Account'}
      </Button>
    </form>
  )
}

type BulkBuyerFields = z.infer<typeof bulkBuyerRegisterSchema>

function BulkBuyerForm() {
  const { register, handleSubmit, control, formState: { errors } } = useForm<BulkBuyerFields>({
    resolver: zodResolver(bulkBuyerRegisterSchema),
    defaultValues: { role: 'BULK_BUYER' },
  })
  const mutation = useRegisterSubmit()

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit((data) => mutation.mutate(data))}>
      <CommonFields register={register} errors={errors} />
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" {...register('email')} className="mt-1.5" />
        <FieldError message={errors.email?.message as string} />
      </div>
      <div>
        <Label htmlFor="company_name">Company Name</Label>
        <Input id="company_name" {...register('company_name')} className="mt-1.5" />
        <FieldError message={errors.company_name?.message as string} />
      </div>
      <div>
        <Label htmlFor="gstin">GSTIN</Label>
        <Input id="gstin" {...register('gstin')} className="mt-1.5" />
        <FieldError message={errors.gstin?.message as string} />
      </div>
      <div>
        <Label>Business Type</Label>
        <Controller
          control={control}
          name="business_type"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="mt-1.5 w-full">
                <SelectValue placeholder="Select business type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="restaurant_chain">Restaurant Chain</SelectItem>
                <SelectItem value="food_processor">Food Processor</SelectItem>
                <SelectItem value="institution">Institution</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        <FieldError message={errors.business_type?.message as string} />
      </div>
      <Button type="submit" size="lg" disabled={mutation.isPending} className="mt-2">
        {mutation.isPending ? 'Creating account...' : 'Create Account'}
      </Button>
    </form>
  )
}

type LogisticsFields = z.infer<typeof logisticsRegisterSchema>

function LogisticsForm() {
  const { register, handleSubmit, control, formState: { errors } } = useForm<LogisticsFields>({
    resolver: zodResolver(logisticsRegisterSchema),
    defaultValues: { role: 'LOGISTICS' },
  })
  const mutation = useRegisterSubmit()

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit((data) => mutation.mutate(data))}>
      <CommonFields register={register} errors={errors} />
      <div>
        <Label>Vehicle Type</Label>
        <Controller
          control={control}
          name="vehicle_type"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="mt-1.5 w-full">
                <SelectValue placeholder="Select vehicle type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DRY_VAN">Dry Van</SelectItem>
                <SelectItem value="COLD_VAN">Cold Van</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        <FieldError message={errors.vehicle_type?.message as string} />
      </div>
      <div>
        <Label htmlFor="vehicle_registration_number">Vehicle Registration Number</Label>
        <Input id="vehicle_registration_number" {...register('vehicle_registration_number')} className="mt-1.5" />
        <FieldError message={errors.vehicle_registration_number?.message as string} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="base_state">Base State</Label>
          <Input id="base_state" {...register('base_state')} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="base_city">Base City</Label>
          <Input id="base_city" {...register('base_city')} className="mt-1.5" />
        </div>
      </div>
      <Button type="submit" size="lg" disabled={mutation.isPending} className="mt-2">
        {mutation.isPending ? 'Creating account...' : 'Create Account'}
      </Button>
    </form>
  )
}

type AdminFields = z.infer<typeof adminRegisterSchema>

function AdminForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<AdminFields>({
    resolver: zodResolver(adminRegisterSchema),
    defaultValues: { role: 'ADMIN' },
  })
  const mutation = useRegisterSubmit()

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit((data) => mutation.mutate(data))}>
      <CommonFields register={register} errors={errors} />
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" {...register('email')} className="mt-1.5" />
        <FieldError message={errors.email?.message as string} />
      </div>
      <div>
        <Label htmlFor="designation">Designation (optional)</Label>
        <Input id="designation" {...register('designation')} className="mt-1.5" />
      </div>
      <div>
        <Label htmlFor="admin_code">Admin Registration Code</Label>
        <Input id="admin_code" type="password" {...register('admin_code')} className="mt-1.5" />
        <FieldError message={errors.admin_code?.message as string} />
      </div>
      <Button type="submit" size="lg" disabled={mutation.isPending} className="mt-2">
        {mutation.isPending ? 'Creating account...' : 'Create Account'}
      </Button>
    </form>
  )
}

export default function Register() {
  const [searchParams] = useSearchParams()
  const [role] = useState<UserRole>(() => {
    const param = searchParams.get('role')
    return param && param in ROLE_META ? (param as UserRole) : 'FARMER'
  })
  const meta = ROLE_META[role]

  return (
    <AuthLayout>
      <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-widest text-earth-500">
        Account &rarr; Verify OTP &rarr; Done
      </p>
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-earth-900">Create your account</h1>
      <Link
        to="/"
        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-3 py-1 text-sm font-semibold text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-800 focus-visible:ring-offset-2"
      >
        {meta.emoji} {meta.label}
      </Link>

      <div className="mt-6">
        {role === 'FARMER' && <FarmerForm />}
        {role === 'CONSUMER' && <ConsumerForm />}
        {role === 'BULK_BUYER' && <BulkBuyerForm />}
        {role === 'LOGISTICS' && <LogisticsForm />}
        {role === 'ADMIN' && <AdminForm />}
      </div>

      <p className="mt-6 text-center text-sm text-earth-700">
        Already registered?{' '}
        <Link to="/login" className="font-semibold text-primary-700 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
