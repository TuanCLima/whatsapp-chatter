import {
  Bot,
  Calendar,
  Code,
  Plus,
  Save,
  Settings,
  Trash2,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { API_BASE_URL } from '@/config/api'
import { useToast } from '@/hooks/use-toast'
import {
  assistantConfigService,
  type Tool,
  type ToolParameter,
} from '@/services/AssistantConfigService'
import {
  type PredefinedToolConfig,
  predefinedToolsService,
} from '@/services/PredefinedToolsService'
import PredefinedToolsPage from './PredefinedToolsPage'

type ConfigSection = 'prompt' | 'tools' | 'predefined-tools' | 'settings'

export default function AssistantConfigPage() {
  const [activeSection, setActiveSection] = useState<ConfigSection>('prompt')
  const [prompt, setPrompt] = useState('')
  const [tools, setTools] = useState<Tool[]>([])
  const [predefinedTools, setPredefinedTools] = useState<
    PredefinedToolConfig[]
  >([])
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null)
  const [selectedPredefinedTool, setSelectedPredefinedTool] =
    useState<PredefinedToolConfig | null>(null)
  const [isCreatingTool, setIsCreatingTool] = useState(false)
  const [, setIsLoading] = useState(false)
  const { toast } = useToast()

  // New tool form state
  const [newTool, setNewTool] = useState<Partial<Tool>>({
    name: '',
    description: '',
    parameters: [],
    toolType: 'implementation',
    implementation: '',
  })
  const [selectedImage, setSelectedImage] = useState<File | null>(null)

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        // Load prompt, tools, and predefined tools in parallel
        const [promptResponse, toolsResponse, predefinedToolsResponse] =
          await Promise.all([
            assistantConfigService.getPrompt(),
            assistantConfigService.getTools(),
            predefinedToolsService.getPredefinedTools(),
          ])

        setPrompt(promptResponse.prompt)
        setTools(toolsResponse.tools)
        setPredefinedTools(predefinedToolsResponse.tools)
      } catch (error) {
        console.error('Error loading data:', error)
        toast({
          title: 'Error',
          description: 'Failed to load configuration data',
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [toast])

  const addParameter = () => {
    setNewTool((prev) => ({
      ...prev,
      parameters: [
        ...(prev.parameters || []),
        { name: '', type: 'string', description: '', required: false },
      ],
    }))
  }

  const updateParameter = (
    index: number,
    field: keyof ToolParameter,
    value: string | boolean,
  ) => {
    setNewTool((prev) => ({
      ...prev,
      parameters: prev.parameters?.map((param, i) =>
        i === index ? { ...param, [field]: value } : param,
      ),
    }))
  }

  const removeParameter = (index: number) => {
    setNewTool((prev) => ({
      ...prev,
      parameters: prev.parameters?.filter((_, i) => i !== index),
    }))
  }

  const saveTool = async () => {
    if (!newTool.name || !newTool.description) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      })
      return
    }

    // Validate based on tool type
    if (newTool.toolType === 'implementation' && !newTool.implementation) {
      toast({
        title: 'Error',
        description: 'Implementation is required for implementation tools',
        variant: 'destructive',
      })
      return
    }

    if (
      newTool.toolType === 'image' &&
      !selectedImage &&
      !selectedTool?.imageUrl
    ) {
      toast({
        title: 'Error',
        description: 'Image is required for image tools',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsLoading(true)

      const toolData = {
        name: newTool.name,
        description: newTool.description,
        parameters: newTool.parameters || [],
        toolType: newTool.toolType || 'implementation',
        implementation:
          newTool.toolType === 'implementation'
            ? newTool.implementation
            : undefined,
      }

      if (selectedTool) {
        // Update existing tool
        const response = await assistantConfigService.updateTool(
          selectedTool.id,
          toolData,
          selectedImage,
        )
        const updatedTool = response.tool
        setTools((prev) =>
          prev.map((t) => (t.id === selectedTool.id ? updatedTool : t)),
        )
        setSelectedTool(updatedTool)
      } else {
        // Add new tool
        const response = await assistantConfigService.createTool(
          toolData,
          selectedImage,
        )
        const newToolFromApi = response.tool
        setTools((prev) => [...prev, newToolFromApi])
      }

      setNewTool({
        name: '',
        description: '',
        parameters: [],
        toolType: 'implementation',
        implementation: '',
      })
      setSelectedImage(null)
      setIsCreatingTool(false)

      toast({
        title: 'Success',
        description: selectedTool
          ? 'Tool updated successfully'
          : 'Tool added successfully',
      })
    } catch (error) {
      console.error('Error saving tool:', error)
      toast({
        title: 'Error',
        description: 'Failed to save tool',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const deleteTool = async (toolId: string) => {
    try {
      setIsLoading(true)
      await assistantConfigService.deleteTool(toolId)

      setTools((prev) => prev.filter((t) => t.id !== toolId))
      if (selectedTool?.id === toolId) {
        setSelectedTool(null)
        setIsCreatingTool(false)
      }
      toast({
        title: 'Success',
        description: 'Tool deleted successfully',
      })
    } catch (error) {
      console.error('Error deleting tool:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete tool',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const editTool = (tool: Tool) => {
    setSelectedTool(tool)
    setSelectedPredefinedTool(null)
    setNewTool({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      toolType: tool.toolType,
      implementation: tool.implementation,
    })
    setSelectedImage(null) // Reset selected image when editing
    setIsCreatingTool(true)
    setActiveSection('tools')
  }

  const selectPredefinedTool = (tool: PredefinedToolConfig) => {
    setSelectedPredefinedTool(tool)
    setSelectedTool(null)
    setIsCreatingTool(false)
    setActiveSection('predefined-tools')
  }

  const getPredefinedToolDisplayName = (toolType: string): string => {
    switch (toolType) {
      case 'calendar_management':
        return 'Google Calendar'
      case 'contact_management':
        return 'Contact Management'
      default:
        return toolType
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (l) => l.toUpperCase())
    }
  }

  const getPredefinedToolIcon = (toolType: string) => {
    switch (toolType) {
      case 'calendar_management':
        return Calendar
      case 'contact_management':
        return Users
      default:
        return Settings
    }
  }

  const savePrompt = async () => {
    try {
      setIsLoading(true)
      await assistantConfigService.savePrompt(prompt)
      toast({
        title: 'Success',
        description: 'Prompt saved successfully',
      })
    } catch (error) {
      console.error('Error saving prompt:', error)
      toast({
        title: 'Error',
        description: 'Failed to save prompt',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const renderSidebar = () => (
    <div className="w-80 bg-card border-r border-border h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold">Assistant Configuration</h2>
        <p className="text-sm text-muted-foreground">
          Configure your WhatsApp assistant
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {/* Main sections */}
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => {
                setActiveSection('prompt')
                setIsCreatingTool(false)
                setSelectedTool(null)
                setSelectedPredefinedTool(null)
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
              type="button"
              onClick={() => {
                setActiveSection('tools')
                setIsCreatingTool(false)
                setSelectedTool(null)
                setSelectedPredefinedTool(null)
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                activeSection === 'tools' && !isCreatingTool && !selectedTool
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              <Code className="h-4 w-4" />
              Custom Tools
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveSection('predefined-tools')
                setIsCreatingTool(false)
                setSelectedTool(null)
                setSelectedPredefinedTool(null)
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                activeSection === 'predefined-tools' && !selectedPredefinedTool
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              <Calendar className="h-4 w-4" />
              Predefined Tools
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveSection('settings')
                setIsCreatingTool(false)
                setSelectedTool(null)
                setSelectedPredefinedTool(null)
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
                      setSelectedPredefinedTool(null)
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

                {tools.map((tool) => (
                  <div key={tool.id} className="group">
                    <button
                      type="button"
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

          {/* Predefined Tools list */}
          {activeSection === 'predefined-tools' && (
            <>
              <Separator className="my-4" />
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Predefined Tools
                  </span>
                </div>

                {predefinedTools.map((tool) => {
                  const IconComponent = getPredefinedToolIcon(tool.toolType)
                  return (
                    <div key={tool.id || tool.toolType} className="group">
                      <button
                        type="button"
                        onClick={() => selectPredefinedTool(tool)}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                          selectedPredefinedTool?.toolType === tool.toolType
                            ? 'bg-secondary text-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                        }`}
                      >
                        <IconComponent className="h-4 w-4" />
                        <span className="truncate flex-1 text-left">
                          {getPredefinedToolDisplayName(tool.toolType)}
                        </span>
                        {tool.enabled && (
                          <div className="h-2 w-2 bg-green-500 rounded-full" />
                        )}
                      </button>
                    </div>
                  )
                })}

                {predefinedTools.length === 0 && (
                  <p className="text-xs text-muted-foreground px-3 py-2">
                    No predefined tools available.
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
            This prompt defines how your assistant will behave and respond to
            users.
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
          Create custom functions that your assistant can use to interact with
          external services or perform specific tasks.
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
                  setSelectedPredefinedTool(null)
                  setSelectedImage(null)
                  setNewTool({
                    name: '',
                    description: '',
                    parameters: [],
                    toolType: 'implementation',
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
                  onChange={(e) =>
                    setNewTool((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g., get_weather"
                />
              </div>
              <div>
                <Label htmlFor="tool-description">Description</Label>
                <Input
                  id="tool-description"
                  value={newTool.description || ''}
                  onChange={(e) =>
                    setNewTool((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Brief description of what this tool does"
                />
              </div>
            </div>

            <div>
              {newTool.toolType === 'implementation' && (
                <div className="flex items-center justify-between mb-3">
                  <Label>Parameters</Label>
                  <Button size="sm" variant="outline" onClick={addParameter}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Parameter
                  </Button>
                </div>
              )}

              <div className="space-y-3">
                {newTool.parameters?.map((param, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: the list is not dynamic
                  <div key={index} className="flex gap-3 items-end">
                    <div className="flex-1">
                      <Input
                        placeholder="Parameter name"
                        value={param.name}
                        onChange={(e) =>
                          updateParameter(index, 'name', e.target.value)
                        }
                      />
                    </div>
                    <div className="w-32">
                      <select
                        className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                        value={param.type}
                        onChange={(e) =>
                          updateParameter(index, 'type', e.target.value)
                        }
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
                        onChange={(e) =>
                          updateParameter(index, 'description', e.target.value)
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={param.required}
                        onChange={(e) =>
                          updateParameter(index, 'required', e.target.checked)
                        }
                        className="h-4 w-4"
                      />
                      <span className="text-sm text-muted-foreground">
                        Required
                      </span>
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

                {(!newTool.parameters || newTool.parameters.length === 0) &&
                  newTool.toolType === 'implementation' && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No parameters defined. Add parameters if your tool needs
                      input.
                    </p>
                  )}
              </div>
            </div>

            <div>
              <Label className="text-base font-medium">Tool Type</Label>
              <div className="flex gap-4 mt-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="implementation-type"
                    name="toolType"
                    value="implementation"
                    checked={newTool.toolType === 'implementation'}
                    onChange={(e) =>
                      setNewTool((prev) => ({
                        ...prev,
                        toolType: e.target.value as 'implementation' | 'image',
                      }))
                    }
                    className="h-4 w-4"
                  />
                  <Label
                    htmlFor="implementation-type"
                    className="text-sm font-normal"
                  >
                    Implementation (Code)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="image-type"
                    name="toolType"
                    value="image"
                    checked={newTool.toolType === 'image'}
                    onChange={(e) =>
                      setNewTool((prev) => ({
                        ...prev,
                        toolType: e.target.value as 'implementation' | 'image',
                      }))
                    }
                    className="h-4 w-4"
                  />
                  <Label htmlFor="image-type" className="text-sm font-normal">
                    Image
                  </Label>
                </div>
              </div>
            </div>

            {newTool.toolType === 'implementation' ? (
              <div>
                <Label htmlFor="tool-implementation">Implementation</Label>
                <Textarea
                  id="tool-implementation"
                  value={newTool.implementation || ''}
                  onChange={(e) =>
                    setNewTool((prev) => ({
                      ...prev,
                      implementation: e.target.value,
                    }))
                  }
                  placeholder="Enter the JavaScript/TypeScript code for your tool implementation..."
                  className="min-h-[200px] mt-2 font-mono"
                />
              </div>
            ) : (
              <div>
                <Label htmlFor="tool-image">Image Upload</Label>
                <div className="mt-2 space-y-3">
                  {selectedTool?.imageUrl && !selectedImage && (
                    <div className="p-4 border border-border rounded-md">
                      <p className="text-sm text-muted-foreground mb-2">
                        Current image:
                      </p>
                      <img
                        src={
                          selectedTool.imageUrl.startsWith('http')
                            ? selectedTool.imageUrl
                            : `${API_BASE_URL || 'http://localhost:3000'}/api/assistant${selectedTool.imageUrl}`
                        }
                        alt={selectedTool.imageName || 'Tool image'}
                        className="max-w-xs max-h-48 object-contain rounded"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedTool.imageName}
                      </p>
                    </div>
                  )}
                  <input
                    type="file"
                    id="tool-image"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null
                      setSelectedImage(file)
                    }}
                    className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                  />
                  {selectedImage && (
                    <div className="p-4 border border-border rounded-md">
                      <p className="text-sm text-muted-foreground mb-2">
                        Selected image:
                      </p>
                      <img
                        src={URL.createObjectURL(selectedImage)}
                        alt="Preview"
                        className="max-w-xs max-h-48 object-contain rounded"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedImage.name}
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Upload an image that will be sent to WhatsApp users when
                    this tool is called. Supported formats: JPG, PNG, GIF (max
                    5MB)
                  </p>
                </div>
              </div>
            )}

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
                  setSelectedPredefinedTool(null)
                  setSelectedImage(null)
                  setNewTool({
                    name: '',
                    description: '',
                    parameters: [],
                    toolType: 'implementation',
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
        {activeSection === 'predefined-tools' && !selectedPredefinedTool && (
          <PredefinedToolsPage />
        )}
        {activeSection === 'predefined-tools' && selectedPredefinedTool && (
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-semibold mb-2">
                {getPredefinedToolDisplayName(selectedPredefinedTool.toolType)}
              </h3>
              <p className="text-muted-foreground">
                Configure the{' '}
                {getPredefinedToolDisplayName(selectedPredefinedTool.toolType)}{' '}
                integration.
              </p>
            </div>
            <PredefinedToolsPage />
          </div>
        )}
        {activeSection === 'settings' && renderSettingsConfig()}
      </div>
    </div>
  )
}
