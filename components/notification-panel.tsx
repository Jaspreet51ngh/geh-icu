"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Bell, Clock, User, ArrowRightLeft, CheckCircle, XCircle, Activity } from "lucide-react"

interface NotificationPanelProps {
  notifications: any[]
  onClearNotification?: (id: number) => void
}

export function NotificationPanel({ notifications, onClearNotification }: NotificationPanelProps) {
  const [isOpen, setIsOpen] = useState(false)

  const unreadCount = notifications.filter((n) => !n.read).length

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "transfer_request":
        return <ArrowRightLeft className="h-4 w-4 text-blue-500" />
      case "transfer_update":
        return <Activity className="h-4 w-4 text-orange-500" />
      case "transfer_approved":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "transfer_rejected":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Bell className="h-4 w-4" />
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "transfer_request":
        return "bg-blue-50 border-blue-200"
      case "transfer_update":
        return "bg-orange-50 border-orange-200"
      case "transfer_approved":
        return "bg-green-50 border-green-200"
      case "transfer_rejected":
        return "bg-red-50 border-red-200"
      default:
        return "bg-gray-50 border-gray-200"
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="fixed bottom-4 right-4 z-50 bg-white shadow-lg border-gray-300 hover:bg-gray-50"
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
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            <Badge variant="outline">{unreadCount} unread</Badge>
          </div>

          <div className="space-y-3 max-h-64 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                <Bell className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg border ${getNotificationColor(notification.type)}`}
                >
                  <div className="flex items-start gap-3">
                    {getNotificationIcon(notification.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{notification.title}</p>
                      <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Clock className="h-3 w-3 text-gray-400" />
                        <p className="text-xs text-gray-500">
                          {new Date(notification.timestamp).toLocaleTimeString()}
                        </p>
                        {onClearNotification && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onClearNotification(notification.id)}
                            className="h-4 w-4 p-0 ml-auto text-gray-400 hover:text-gray-600"
                          >
                            ×
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <Button 
              variant="outline" 
              className="w-full text-sm bg-transparent"
              onClick={() => notifications.forEach(n => onClearNotification?.(n.id))}
            >
              Clear All
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
