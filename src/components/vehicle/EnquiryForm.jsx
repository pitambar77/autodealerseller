import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Send } from 'lucide-react';
import { MessageCircle } from 'lucide-react';
import { Button, Field, Input, PhoneInput, Textarea, Checkbox, Alert } from '../ui';
import { useStore } from '../../store/AppStore';
import { formatPhone, isValidPhone } from '../../lib/phone';
import { vehicleNoun } from '../../data/vehicleTypes';

const schema = z.object({
  buyerName: z.string().trim().min(2, 'Enter your name'),
  buyerPhone: z
    .string()
    .trim()
    .refine((v) => isValidPhone(v), 'Enter a valid mobile number'),
  buyerEmail: z.string().trim().email('Enter a valid email').or(z.literal('')),
  message: z.string().trim().min(10, 'Tell the seller a little more (at least 10 characters)').max(600, 'Keep it under 600 characters'),
  testDrive: z.boolean().optional(),
  loanHelp: z.boolean().optional(),
});

/**
 * Enquiry form used on the details page and the dedicated contact screen.
 */
export function EnquiryForm({ vehicle, compact, onSent }) {
  const { me, addEnquiry } = useStore();
  const [sent, setSent] = useState(null);
  const [failed, setFailed] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      buyerName: me?.role === 'buyer' ? me.name : '',
      buyerPhone: me?.role === 'buyer' ? me.phone || '' : '',
      buyerEmail: me?.role === 'buyer' ? me.email : '',
      message: `Hi, I'm interested in your ${vehicle.year} ${vehicle.make} ${vehicle.model}. Is it still available?`,
      testDrive: true,
      loanHelp: false,
    },
  });

  const submit = async (data) => {
    setFailed('');
    const extras = [data.testDrive && 'Wants a test drive', data.loanHelp && 'Interested in loan assistance'].filter(Boolean).join(' · ');
    let e;
    try {
      e = await addEnquiry({ vehicleId: vehicle.id, buyerName: data.buyerName, buyerPhone: formatPhone(data.buyerPhone), buyerEmail: data.buyerEmail, message: extras ? `${data.message}\n\n${extras}` : data.message });
    } catch (err) {
      setFailed(err.message);
      return;
    }
    setSent(e);
    onSent?.(e);
  };

  if (sent) {
    return (
      <div className="rounded-xl border border-ok-100 bg-ok-50 p-5 text-center">
        <CheckCircle2 className="mx-auto h-9 w-9 text-ok-600" />
        <h3 className="mt-2 text-base font-bold">Enquiry sent to the seller</h3>
        <p className="mt-1 text-sm text-mist-700">
          Reference <span className="font-mono font-semibold">{sent.id.toUpperCase()}</span>.{' '}
          {sent.buyerId ? 'Replies appear in your Messages as soon as the seller answers.' : "You'll get the seller's reply by SMS with a link to your conversation."}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button size="sm" icon={MessageCircle} to={sent.buyerId ? `/buyer/messages?c=${sent.id}` : sent.conversationPath}>
            Open conversation
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSent(null);
              reset();
            }}
          >
            Send another message
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-3.5">
      {failed && (
        <Alert tone="error" title="Your enquiry didn't go through">
          {failed} Your message is still here — try sending it again.
        </Alert>
      )}
      <div className={compact ? 'space-y-3.5' : 'grid gap-3.5 sm:grid-cols-2'}>
        <Field label="Your name" error={errors.buyerName?.message} htmlFor={`en-name-${vehicle.id}`} required>
          <Input id={`en-name-${vehicle.id}`} {...register('buyerName')} error={errors.buyerName} autoComplete="name" />
        </Field>
        <Field label="Mobile number" error={errors.buyerPhone?.message} htmlFor={`en-phone-${vehicle.id}`} required>
          <Controller name="buyerPhone" control={control} render={({ field }) => <PhoneInput id={`en-phone-${vehicle.id}`} value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={errors.buyerPhone} />} />
        </Field>
      </div>
      {!compact && (
        <Field label="Email" optional error={errors.buyerEmail?.message} htmlFor={`en-email-${vehicle.id}`}>
          <Input id={`en-email-${vehicle.id}`} type="email" {...register('buyerEmail')} error={errors.buyerEmail} autoComplete="email" />
        </Field>
      )}
      <Field label="Message" error={errors.message?.message} htmlFor={`en-msg-${vehicle.id}`} required>
        <Textarea id={`en-msg-${vehicle.id}`} rows={compact ? 3 : 4} {...register('message')} error={errors.message} />
      </Field>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Checkbox label="I'd like a test drive" {...register('testDrive')} />
        <Checkbox label={`Help me with a loan for this ${vehicleNoun(vehicle)}`} {...register('loanHelp')} />
      </div>
      <Button type="submit" className="w-full" loading={isSubmitting} icon={Send}>
        Send enquiry
      </Button>

    </form>
  );
}
