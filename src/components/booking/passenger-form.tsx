"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Save, Loader2, UserRound } from "lucide-react";
import { z } from "zod";
import { savePassengerDraftAction } from "@/actions/booking";
import { passengerDetailsFormSchema } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/surfaces";

type FormValues = z.infer<typeof passengerDetailsFormSchema>;

export function PassengerForm({
  holdId,
  passengerCount,
  defaults,
}: {
  holdId: string;
  passengerCount: number;
  defaults: FormValues;
}) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(passengerDetailsFormSchema),
    defaultValues: defaults,
    mode: "onBlur",
  });
  const { fields, append, remove } = useFieldArray({ control, name: "passengers" });

  async function onSubmit(values: FormValues) {
    setPending(true);
    setServerError(null);
    const result = await savePassengerDraftAction({
      holdId,
      draft: {
        ...values,
        contactPhone: values.contactPhone || undefined,
      },
    });
    if (!result.ok) {
      setServerError(result.error ?? "Traveller details could not be saved.");
      setPending(false);
      return;
    }
    router.push(`/checkout/${holdId}`);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {serverError ? <Alert tone="danger">{serverError}</Alert> : null}
      <div className="space-y-4">
        {fields.map((field, index) => (
          <fieldset
            key={field.id}
            className="rounded-small border border-line-light bgwhite/40 p-4"
          >
            <legend className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
              <UserRound aria-hidden="true" className="h-3.5 w-3.5" />
              Passenger {index + 1}
            </legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_6rem_9rem]">
              <div>
                <Label htmlFor={`passengers.${index}.fullName`}>Full name</Label>
                <Input
                  id={`passengers.${index}.fullName`}
                  autoComplete="name"
                  aria-invalid={Boolean(errors.passengers?.[index]?.fullName)}
                  {...register(`passengers.${index}.fullName`)}
                />
                {errors.passengers?.[index]?.fullName ? (
                  <p className="mt-1.5 text-xs text-danger-ink">
                    {errors.passengers[index]?.fullName?.message}
                  </p>
                ) : null}
              </div>
              <div>
                <Label htmlFor={`passengers.${index}.age`}>Age</Label>
                <Input
                  id={`passengers.${index}.age`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={120}
                  aria-invalid={Boolean(errors.passengers?.[index]?.age)}
                  {...register(`passengers.${index}.age`, { valueAsNumber: true })}
                />
                {errors.passengers?.[index]?.age ? (
                  <p className="mt-1.5 text-xs text-danger-ink">
                    {errors.passengers[index]?.age?.message}
                  </p>
                ) : null}
              </div>
              <div>
                <Label htmlFor={`passengers.${index}.gender`}>Gender</Label>
                <Select
                  id={`passengers.${index}.gender`}
                  {...register(`passengers.${index}.gender`)}
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </Select>
              </div>
            </div>
            {fields.length > 1 ? (
              <Button
                type="button"
                variant="ghost-light"
                size="sm"
                className="mt-2"
                onClick={() => remove(index)}
              >
                Remove passenger {index + 1}
              </Button>
            ) : null}
          </fieldset>
        ))}
      </div>
      {fields.length < passengerCount ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            append({ fullName: "", age: 30, gender: "female" })
          }
        >
          <Plus aria-hidden="true" className="h-3.5 w-3.5" />
          Add passenger
        </Button>
      ) : null}

      <div className="rounded-small border border-line-light bg-white/40 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
          Contact for this booking
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="contactEmail">Email</Label>
            <Input
              id="contactEmail"
              type="email"
              autoComplete="email"
              aria-invalid={Boolean(errors.contactEmail)}
              {...register("contactEmail")}
            />
            {errors.contactEmail ? (
              <p className="mt-1.5 text-xs text-danger-ink">
                {errors.contactEmail.message}
              </p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="contactPhone">Phone (optional)</Label>
            <Input
              id="contactPhone"
              type="tel"
              autoComplete="tel"
              placeholder="+91 90000 00000"
              {...register("contactPhone")}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <Save aria-hidden="true" className="h-4 w-4" />
          )}
          {pending ? "Saving details…" : "Save & continue to demo checkout"}
        </Button>
        <p className="text-[11px] text-ink-muted">
          Details stay on the server-side hold draft; nothing is pre-paid here.
        </p>
      </div>
    </form>
  );
}
