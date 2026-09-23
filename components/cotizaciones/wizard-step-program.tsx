'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'

import { Field, FieldLabel } from '@/components/ui/field'
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import {
    formatMoney,
    type QuotationDraft,
    type QuotationSchoolIncludeLine
} from '@/lib/cotizaciones/shared'
import {
    parseIncludes,
    toActive,
    toOptions,
    type CourseRow,
    type ProgramRow,
    type ScheduleRow,
    type SchoolIncludeRow,
    type SchoolRow
} from './types'

function courseLabel(course: CourseRow): string {
    return `${course.name} · ${course.weeks} semanas · ${course.hoursPerWeek} h/sem`
}

export function WizardStepProgram({
    draft,
    setDraft,
    programs,
    schools,
    schedules,
    courses,
    schoolIncludes
}: {
    draft: QuotationDraft
    setDraft: Dispatch<SetStateAction<QuotationDraft>>
    programs?: ProgramRow[]
    schools?: SchoolRow[]
    schedules?: ScheduleRow[]
    courses?: CourseRow[]
    schoolIncludes?: SchoolIncludeRow[]
}) {
    const [selection, setSelection] = useState(() => {
        const courseId = draft.course?.id ?? null
        const courseRow = courses?.find((row) => row.id === courseId)
        return {
            programId: courseRow?.programId ?? draft.program?.id ?? null,
            schoolId: courseRow?.schoolId ?? null,
            courseId
        }
    })

    const availablePrograms = toActive(programs)
    const availableSchools = toActive(schools)
    const availableSchedules = toActive(schedules)
    const availableCourses = toActive(courses)

    const schoolIdsForProgram = new Set(
        availableCourses
            .filter((course) => course.programId === selection.programId)
            .map((course) => course.schoolId)
    )
    const programSchools = selection.programId
        ? availableSchools.filter(
              (school) =>
                  schoolIdsForProgram.has(school.id) ||
                  availableCourses.some(
                      (course) =>
                          course.schoolId === school.id &&
                          course.programId === selection.programId
                  )
          )
        : availableSchools

    const visibleCourses = availableCourses.filter(
        (course) =>
            (!selection.programId ||
                course.programId === selection.programId) &&
            (!selection.schoolId || course.schoolId === selection.schoolId)
    )

    const selectedCourse =
        visibleCourses.find((course) => course.id === selection.courseId) ||
        null

    function includesForSchool(
        schoolId: number | null | undefined
    ): QuotationSchoolIncludeLine[] {
        const id = Number(schoolId ?? -1)
        return toActive(schoolIncludes)
            .filter((row) => row.schoolIds.includes(id))
            .map((row) => ({
                id: row.id,
                name: row.name,
                description: row.description ?? ''
            }))
    }

    function selectProgram(value: string | null) {
        const id = value ? Number(value) : null
        setSelection({ programId: id, schoolId: null, courseId: null })
        const program = availablePrograms.find((row) => row.id === id) || null
        setDraft((prev) => ({
            ...prev,
            program: program
                ? {
                      id: program.id,
                      name: program.name,
                      includes: parseIncludes(program.includes)
                  }
                : null,
            course: null,
            schoolIncludes: []
        }))
    }

    function selectSchool(value: string | null) {
        const id = value ? Number(value) : null
        setSelection((prev) => ({ ...prev, schoolId: id, courseId: null }))
        setDraft((prev) => ({
            ...prev,
            course: null,
            schoolIncludes: []
        }))
    }

    function selectCourse(value: string | null) {
        const id = value ? Number(value) : null
        setSelection((prev) => ({ ...prev, courseId: id }))
        const courseRow =
            visibleCourses.find((course) => course.id === id) || null
        if (!courseRow || !draft.program) {
            setDraft((prev) => ({
                ...prev,
                course: null,
                schoolIncludes: []
            }))
            return
        }
        const school = availableSchools.find(
            (row) => row.id === courseRow.schoolId
        )
        const schedule = availableSchedules.find(
            (row) => row.id === courseRow.scheduleId
        )
        setDraft((prev) => ({
            ...prev,
            course: {
                id: courseRow.id,
                schoolId: courseRow.schoolId,
                schoolName: school?.name ?? '',
                name: courseRow.name,
                description: courseRow.description ?? '',
                scheduleName: schedule?.name ?? '',
                weeks: courseRow.weeks,
                hoursPerWeek: courseRow.hoursPerWeek,
                price: courseRow.price
            },
            schoolIncludes: includesForSchool(courseRow.schoolId)
        }))
    }

    return (
        <div className='space-y-4'>
            <div className='grid gap-4 sm:grid-cols-3'>
                <Field>
                    <FieldLabel>Programa</FieldLabel>
                    <Select
                        value={selection.programId ? String(selection.programId) : ''}
                        onValueChange={selectProgram}
                        items={availablePrograms.map((program) => ({
                            value: String(program.id),
                            label: program.name
                        }))}>
                        <SelectTrigger aria-label='Programa'>
                            <SelectValue placeholder='Selecciona un programa' />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                {toOptions(availablePrograms).map((option) => (
                                    <SelectItem
                                        key={option.id}
                                        value={String(option.id)}>
                                        {option.name}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </Field>
                <Field>
                    <FieldLabel>Escuela</FieldLabel>
                    <Select
                        value={selection.schoolId ? String(selection.schoolId) : ''}
                        onValueChange={selectSchool}
                        items={programSchools.map((school) => ({
                            value: String(school.id),
                            label: school.name
                        }))}>
                        <SelectTrigger aria-label='Escuela'>
                            <SelectValue placeholder='Selecciona una escuela' />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                {toOptions(programSchools).map((option) => (
                                    <SelectItem
                                        key={option.id}
                                        value={String(option.id)}>
                                        {option.name}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </Field>
                <Field>
                    <FieldLabel>Curso</FieldLabel>
                    <Select
                        value={selection.courseId ? String(selection.courseId) : ''}
                        onValueChange={selectCourse}
                        items={visibleCourses.map((course) => ({
                            value: String(course.id),
                            label: courseLabel(course)
                        }))}>
                        <SelectTrigger aria-label='Curso'>
                            <SelectValue placeholder='Selecciona un curso' />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                {visibleCourses.map((course) => (
                                    <SelectItem
                                        key={course.id}
                                        value={String(course.id)}>
                                        {courseLabel(course)}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </Field>
            </div>

            {availablePrograms.length === 0 && (
                <p className='text-sm text-muted-foreground'>
                    Crea programas desde Administración → Cotizaciones
                    → Programas.
                </p>
            )}

            {selectedCourse && (
                <div className='rounded-lg border bg-muted/40 p-3 text-sm'>
                    <p className='font-medium'>{selectedCourse.name}</p>
                    <p className='mt-1 text-muted-foreground'>
                        {selectedCourse.description || 'Sin descripción'}
                    </p>
                    <p className='mt-2'>
                        Precio total:{' '}
                        <span className='font-semibold'>
                            {formatMoney(
                                selectedCourse.price,
                                draft.currency
                            )}
                        </span>
                    </p>
                </div>
            )}
        </div>
    )
}