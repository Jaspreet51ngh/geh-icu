"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Activity, Stethoscope, User, Shield } from "lucide-react"
import { useRouter } from "next/navigation"

export default function Home() {
  const [username, setUsername] = useState("")
  const [role, setRole] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !role) return

    setIsLoading(true)
    
    // Simulate login process
    setTimeout(() => {
      // Store user info in localStorage
      localStorage.setItem("username", username)
      localStorage.setItem("userRole", role)
      
      // Redirect based on role
      switch (role) {
        case "nurse":
          router.push("/dashboard")
          break
        case "doctor":
          router.push("/doctor-review")
          break
        case "admin":
          router.push("/admin-dashboard")
          break
        default:
          router.push("/dashboard")
      }
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-2xl border-0">
          <CardHeader className="text-center pb-6">
            <div className="mx-auto mb-4 p-3 bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center">
              <Activity className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              ICU Transfer System
            </CardTitle>
            <CardDescription className="text-gray-600">
              AI-powered patient transfer management
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={role} onValueChange={setRole} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nurse">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4" />
                        <span>Nurse</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="doctor">
                      <div className="flex items-center space-x-2">
                        <Stethoscope className="h-4 w-4" />
                        <span>Doctor</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex items-center space-x-2">
                        <Shield className="h-4 w-4" />
                        <span>Department Admin</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                disabled={isLoading || !username || !role}
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
            
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="text-center text-sm text-gray-600">
                <p className="mb-2 font-medium">Demo Credentials:</p>
                <div className="space-y-1 text-xs">
                  <p><strong>Nurse:</strong> Any username, select "Nurse" role</p>
                  <p><strong>Doctor:</strong> Any username, select "Doctor" role</p>
                  <p><strong>Admin:</strong> Any username, select "Department Admin" role</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <div className="mt-8 text-center">
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 shadow-lg">
            <h3 className="font-semibold text-gray-900 mb-2">System Features</h3>
            <div className="grid grid-cols-1 gap-2 text-sm text-gray-600">
              <div className="flex items-center justify-center space-x-2">
                <Activity className="h-4 w-4 text-blue-600" />
                <span>Real-time patient monitoring</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <Stethoscope className="h-4 w-4 text-green-600" />
                <span>AI-powered transfer predictions</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <User className="h-4 w-4 text-purple-600" />
                <span>Role-based access control</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
