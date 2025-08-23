'use client'

import React from 'react'
import { redirect } from 'next/navigation'

export default function SettingsPage() {
  // Redirect to time slots as the default settings page
  redirect('/settings/time-slots')
}