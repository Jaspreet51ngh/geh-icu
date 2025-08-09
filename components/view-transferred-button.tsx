"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export default function ViewTransferredButton() {
  const router = useRouter()
  return (
    <Button onClick={() => router.push("/common-dashboard")}>
      View Transferred Patients
    </Button>
  )
}


