import { useState, useEffect } from 'react'
import { Plus, Save, Settings, Bot, Code, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { ScrollArea } from '@/components/ui/scroll-area'
import { assistantConfigService, type Tool, type ToolParameter } from '@/services/AssistantConfigService'

type ConfigSection = 'prompt' | 'tools' | 'settings'

export default function AssistantConfigPage() {
  const [activeSection, setActiveSection] = useState<ConfigSection>('prompt')
  const [prompt, setPrompt] = useState('')
  const [tools, setTools] = useState<Tool[]>([])
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null)
  const [isCreatingTool, setIsCreatingTool] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  // New tool form state
  const [newTool, setNewTool] = useState<Partial<Tool>>({
    name: '',
    description: '',
    parameters: [],
    implementation: '',
  })

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        // Load prompt and tools in parallel
        const [promptResponse, toolsResponse] = await Promise.all([
          assistantConfigService.getPrompt(),
          assistantConfigService.getTools(),
        ])
        
        setPrompt(promptResponse.prompt)
        setTools(toolsResponse.tools)
      } catch (error) {
        console.error('Error loading data:', error)
        toast({
          title: "Error",
          description: "Failed to load configuration data",
          variant: "destructive"
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [toast])

  const addParameter = () => {
    setNewTool(prev => ({
      ...prev,
      parameters: [
        ...(prev.parameters || []),
        { name: '', type: 'string', description: '', required: false }
      ]
    }))
  }

  const updateParameter = (index: number, field: keyof ToolParameter, value: string | boolean) => {
    setNewTool(prev => ({
      ...prev,
      parameters: prev.parameters?.map((param, i) => 
        i === index ? { ...param, [field]: value } : param
      )
    }))
  }

  const removeParameter = (index: number) => {
    setNewTool(prev => ({
      ...prev,
      parameters: prev.parameters?.filter((_, i) => i !== index)
    }))
  }

  const saveTool = async () => {
    if (!newTool.name || !newTool.description || !newTool.implementation) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      })
      return
    }

    try {
      setIsLoading(true)
      
      const toolData = {
        name: newTool.name,
        description: newTool.description,
        parameters: newTool.parameters || [],
        implementation: newTool.implementation,
      }

      if (selectedTool) {
        // Update existing tool
        const response = await assistantConfigService.updateTool(selectedTool.id, toolData)
        const updatedTool = response.tool
        setTools(prev => prev.map(t => t.id === selectedTool.id ? updatedTool : t))
        setSelectedTool(updatedTool)
      } else {
        // Add new tool
        const response = await assistantConfigService.createTool(toolData)
        const newToolFromApi = response.tool
        setTools(prev => [...prev, newToolFromApi])
      }

      setNewTool({
        name: '',
        description: '',
        parameters: [],
        implementation: '',
      })
      setIsCreatingTool(false)
      
      toast({
        title: "Success",
        description: selectedTool ? "Tool updated successfully" : "Tool added successfully"
      })
    } catch (error) {
      console.error('Error saving tool:', error)
      toast({
        title: "Error",
        description: "Failed to save tool",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const deleteTool = async (toolId: string) => {
    try {
      setIsLoading(true)
      await assistantConfigService.deleteTool(toolId)
      
      setTools(prev => prev.filter(t => t.id !== toolId))
      if (selectedTool?.id === toolId) {
        setSelectedTool(null)
        setIsCreatingTool(false)
      }
      toast({
        title: "Success",
        description: "Tool deleted successfully"
      })
    } catch (error) {
      console.error('Error deleting tool:', error)
      toast({
        title: "Error",
        description: "Failed to delete tool",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const editTool = (tool: Tool) => {
    setSelectedTool(tool)
    setNewTool({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      implementation: tool.implementation,
    })
    setIsCreatingTool(true)
    setActiveSection('tools')
  }

  const savePrompt = async () => {
    try {
      setIsLoading(true)
      await assistantConfigService.savePrompt(prompt)
      toast({
        title: "Success",
        description: "Prompt saved successfully"
      })
    } catch (error) {
      console.error('Error saving prompt:', error)
      toast({
        title: "Error",
        description: "Failed to save prompt",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const renderSidebar = () => (
    <div className="w-80 bg-card border-r border-border h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold">Assistant Configuration</h2>
        <p className="text-sm text-muted-foreground">Configure your WhatsApp assistant</p>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {/* Main sections */}
          <div className="space-y-1">
            <button
              onClick={() => {
                setActiveSection('prompt')
                setIsCreatingTool(false)
                setSelectedTool(null)
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                activeSection === 'prompt' && !isCreatingTool
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              <Bot className="h-4 w-4" />
              Prompt
            </button>
            
            <button
              onClick={() => {
                setActiveSection('tools')
                setIsCreatingTool(false)
                setSelectedTool(null)
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                activeSection === 'tools' && !isCreatingTool && !selectedTool
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              <Code className="h-4 w-4" />
              Tools
            </button>
            
            <button
              onClick={() => {
                setActiveSection('settings')
                setIsCreatingTool(false)
                setSelectedTool(null)
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                activeSection === 'settings' && !isCreatingTool
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
          </div>

          {/* Tools list */}
          {activeSection === 'tools' && (
            <>
              <Separator className="my-4" />
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Custom Tools
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsCreatingTool(true)
                      setSelectedTool(null)
                      setNewTool({
                        name: '',
                        description: '',
                        parameters: [],
                        implementation: '',
                      })
                    }}
                    className="h-6 w-6 p-0"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                
                {tools.map(tool => (
                  <div key={tool.id} className="group">
                    <button
                      onClick={() => editTool(tool)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${
                        selectedTool?.id === tool.id
                          ? 'bg-secondary text-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                      }`}
                    >
                      <span className="truncate">{tool.name}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteTool(tool.id)
                        }}
                        className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </button>
                  </div>
                ))}
                
                {tools.length === 0 && (
                  <p className="text-xs text-muted-foreground px-3 py-2">
                    No custom tools yet. Click + to create one.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )

  const renderPromptConfig = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-semibold mb-2">Assistant Prompt</h3>
        <p className="text-muted-foreground">
          Configure the personality and behavior of your WhatsApp assistant.
        </p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>System Prompt</CardTitle>
          <CardDescription>
            This prompt defines how your assistant will behave and respond to users.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="prompt">Prompt Content</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your assistant's system prompt here. For example: You are a helpful customer service assistant for my business. Be friendly, professional, and always try to help customers with their questions..."
              className="min-h-[400px] mt-2 text-sm leading-relaxed"
            />
          </div>
          
          <Button onClick={savePrompt} className="w-full">
            <Save className="h-4 w-4 mr-2" />
            Save Prompt
          </Button>
        </CardContent>
      </Card>
    </div>
  )

  const renderToolConfig = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-semibold mb-2">Custom Tools</h3>
        <p className="text-muted-foreground">
          Create custom functions that your assistant can use to interact with external services or perform specific tasks.
        </p>
      </div>

      {!isCreatingTool && !selectedTool ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Code className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h4 className="text-lg font-medium mb-2">No tool selected</h4>
              <p className="text-muted-foreground mb-4">
                Select a tool from the sidebar to edit it, or create a new one.
              </p>
              <Button
                onClick={() => {
                  setIsCreatingTool(true)
                  setSelectedTool(null)
                  setNewTool({
                    name: '',
                    description: '',
                    parameters: [],
                    implementation: '',
                  })
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Tool
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedTool ? 'Edit Tool' : 'Create New Tool'}
            </CardTitle>
            <CardDescription>
              Define the tool's metadata and implementation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tool-name">Tool Name</Label>
                <Input
                  id="tool-name"
                  value={newTool.name || ''}
                  onChange={(e) => setNewTool(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., get_weather"
                />
              </div>
              <div>
                <Label htmlFor="tool-description">Description</Label>
                <Input
                  id="tool-description"
                  value={newTool.description || ''}
                  onChange={(e) => setNewTool(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of what this tool does"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <Label>Parameters</Label>
                <Button size="sm" variant="outline" onClick={addParameter}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Parameter
                </Button>
              </div>
              
              <div className="space-y-3">
                {newTool.parameters?.map((param, index) => (
                  <div key={index} className="flex gap-3 items-end">
                    <div className="flex-1">
                      <Input
                        placeholder="Parameter name"
                        value={param.name}
                        onChange={(e) => updateParameter(index, 'name', e.target.value)}
                      />
                    </div>
                    <div className="w-32">
                      <select
                        className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                        value={param.type}
                        onChange={(e) => updateParameter(index, 'type', e.target.value)}
                      >
                        <option value="string">string</option>
                        <option value="number">number</option>
                        <option value="boolean">boolean</option>
                        <option value="array">array</option>
                        <option value="object">object</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <Input
                        placeholder="Description"
                        value={param.description}
                        onChange={(e) => updateParameter(index, 'description', e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={param.required}
                        onChange={(e) => updateParameter(index, 'required', e.target.checked)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm text-muted-foreground">Required</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeParameter(index)}
                      className="h-9 w-9 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                
                {(!newTool.parameters || newTool.parameters.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No parameters defined. Add parameters if your tool needs input.
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="tool-implementation">Implementation</Label>
              <Textarea
                id="tool-implementation"
                value={newTool.implementation || ''}
                onChange={(e) => setNewTool(prev => ({ ...prev, implementation: e.target.value }))}
                placeholder="Enter the JavaScript/TypeScript code for your tool implementation..."
                className="min-h-[200px] mt-2 font-mono"
              />
            </div>

            <div className="flex gap-3">
              <Button onClick={saveTool} className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                {selectedTool ? 'Update Tool' : 'Save Tool'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreatingTool(false)
                  setSelectedTool(null)
                  setNewTool({
                    name: '',
                    description: '',
                    parameters: [],
                    implementation: '',
                  })
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )

  const renderSettingsConfig = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-semibold mb-2">Settings</h3>
        <p className="text-muted-foreground">
          Additional configuration options for your assistant.
        </p>
      </div>
      
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h4 className="text-lg font-medium mb-2">Coming Soon</h4>
            <p className="text-muted-foreground">
              Additional settings will be available here in future updates.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="h-full flex bg-background">
      {renderSidebar()}
      <div className="flex-1 p-6 overflow-auto">
        {activeSection === 'prompt' && renderPromptConfig()}
        {activeSection === 'tools' && renderToolConfig()}
        {activeSection === 'settings' && renderSettingsConfig()}
      </div>
    </div>
  )
}
