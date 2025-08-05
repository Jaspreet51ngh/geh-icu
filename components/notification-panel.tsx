"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Bell, Clock, User, ArrowRightLeft } from "lucide-react"

interface NotificationPanelProps {
  notifications: any[]
}

export function NotificationPanel({ notifications }: NotificationPanelProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Mock notifications based on user role
  const mockNotifications = [
    {
      id: 1,
      type: "transfer_request",
      message: "Transfer request for Sarah Johnson (ICU-001) to General Ward",
      timestamp: new Date(Date.now() - 5 * 60000), // 5 minutes ago
      from: "Nurse Kelly",
      unread: true,
    },
    {
      id: 2,
      type: "approval_needed",
      message: "Doctor approval needed for Michael Chen transfer",
      timestamp: new Date(Date.now() - 15 * 60000), // 15 minutes ago
      from: "System",
      unread: true,
    },
    {
      id: 3,
      type: "transfer_approved",
      message: "Transfer approved: David Thompson → General Ward",
      timestamp: new Date(Date.now() - 30 * 60000), // 30 minutes ago
      from: "Dr. Smith",
      unread: false,
    },
  ]

  const unreadCount = mockNotifications.filter((n) => n.unread).length

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "transfer_request":
        return <ArrowRightLeft className="h-4 w-4 text-blue-500" />
      case "approval_needed":
        return <Clock className="h-4 w-4 text-yellow-500" />
      case "transfer_approved":
        return <User className="h-4 w-4 text-green-500" />
      default:
        return <Bell className="h-4 w-4" />
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative border-blue-300 text-blue-100 hover:bg-blue-800 bg-transparent"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs bg-red-500 text-white">{unreadCount}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-ge-navy">Notifications</h3>
            <Badge variant="outline">{unreadCount} unread</Badge>
          </div>

          <div className="space-y-3 max-h-64 overflow-y-auto">
            {mockNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-3 rounded-lg border ${
                  notification.unread ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  {getNotificationIcon(notification.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{notification.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-slate-500">From: {notification.from}</p>
                      <span className="text-xs text-slate-400">•</span>
                      <p className="text-xs text-slate-500">{notification.timestamp.toLocaleTimeString()}</p>
                    </div>
                  </div>
                  {notification.unread && <div className="w-2 h-2 bg-blue-500 rounded-full"></div>}
                </div>
              </div>
            ))}
          </div>

          <Button variant="outline" className="w-full text-sm bg-transparent">
            View All Notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
