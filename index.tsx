import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, GenerateContentResponse, Chat, Part } from "@google/genai";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// --- TYPES ---
type AppStep = 'configuration' | 'characters' | 'generation' | 'comic';

interface Config {
    storyScript: string;
    textModel: string;
    imageModel: string;
    aspectRatio: string;
    pages: number;
    seed: string;
    artStyle: string;
    comicEra: string;
    additionalInstructions: string;
}

interface Character {
    id: string;
    name: string;
    description: string;
    referenceImages: { file: File, base64: string }[];
}

interface ComicPanel {
    id: number;
    page: number;
    panel: number;
    sceneDescription: string;
    panelText: string;
    imageUrl?: string;
    status: 'pending' | 'generating' | 'done' | 'error';
}

type GenerationStage = 'idle' | 'story' | 'images' | 'assembly' | 'done';
interface GenerationProgress {
    stage: GenerationStage;
    message: string;
    percentage: number;
}

// --- ICONS (as React Components) ---
const IconSparkles = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C11.45 2 11 2.45 11 3V4.5C11 5.05 11.45 5.5 12 5.5C12.55 5.5 13 5.05 13 4.5V3C13 2.45 12.55 2 12 2ZM6.09 4.67C5.7 4.29 5.07 4.29 4.68 4.67C4.29 5.06 4.29 5.69 4.68 6.08L5.78 7.18C6.17 7.57 6.8 7.57 7.19 7.18C7.58 6.8 7.58 6.17 7.19 5.78L6.09 4.67ZM18.32 4.68C17.93 4.29 17.3 4.29 16.91 4.68L15.81 5.78C15.42 6.17 15.42 6.8 15.81 7.19C16.2 7.58 16.83 7.58 17.22 7.19L18.32 6.09C18.71 5.7 18.71 5.07 18.32 4.68ZM12 6.5C8.96 6.5 6.5 8.96 6.5 12C6.5 15.04 8.96 17.5 12 17.5C15.04 17.5 17.5 15.04 17.5 12C17.5 8.96 15.04 6.5 12 6.5ZM2 12C2 11.45 2.45 11 3 11H4.5C5.05 11 5.5 11.45 5.5 12C5.5 12.55 5.05 13 4.5 13H3C2.45 13 2 12.55 2 12ZM19.5 11H21C21.55 11 22 11.45 22 12C22 12.55 21.55 13 21 13H19.5C18.95 13 18.5 12.55 18.5 12C18.5 11.45 18.95 11 19.5 11ZM6.08 18.32C6.47 18.71 6.47 19.34 6.08 19.73C5.7 20.12 5.07 20.12 4.68 19.73L3.58 18.63C3.19 18.24 3.19 17.61 3.58 17.22C3.97 16.83 4.6 16.83 4.99 17.22L6.08 18.32ZM18.33 18.32L19.43 17.22C19.82 16.83 20.45 16.83 20.84 17.22C21.23 17.61 21.23 18.24 20.84 18.63L19.74 19.73C19.35 20.12 18.72 20.12 18.33 19.73C17.94 19.34 17.94 18.71 18.33 18.32ZM12 18.5C11.45 18.5 11 18.95 11 19.5V21C11 21.55 11.45 22 12 22C12.55 22 13 21.55 13 21V19.5C13 18.95 12.55 18.5 12 18.5Z" /></svg>;
const IconCog = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61.22l2-3.46c.12-.22-.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" /></svg>;
const IconPeople = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" /></svg>;
const IconPencil = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>;
const IconBook = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z" /></svg>;
const IconUpload = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z" /></svg>;
const IconCheck = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></svg>;
const IconSpinner = () => <svg className="spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{opacity: 0.2}}></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>;
const IconError = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>;


// --- HELPER FUNCTIONS ---
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

// --- MODEL LISTS ---
const textModels = [
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-flash-lite-preview-06-17', name: 'Gemini 2.5 Flash-Lite Preview' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash-Lite' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
    { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash-8B' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
];

const imageModels = [
    { id: 'imagen-4.0-generate-preview-06-06', name: 'Imagen 4 Preview' },
    { id: 'imagen-4.0-ultra-generate-preview-06-06', name: 'Imagen 4 Ultra Preview' },
    { id: 'imagen-3.0-generate-002', name: 'Imagen 3' },
    { id: 'gemini-2.0-flash-preview-image-generation', name: 'Gemini 2.0 Flash (Native Image Gen)' },
];

// --- APP COMPONENTS ---

const Header = ({ currentStep }: { currentStep: AppStep }) => {
    const steps = [
        { id: 'configuration', label: 'Configuration', icon: <IconCog /> },
        { id: 'characters', label: 'Characters', icon: <IconPeople /> },
        { id: 'generation', label: 'Generation', icon: <IconPencil /> },
        { id: 'comic', label: 'Comic', icon: <IconBook /> },
    ];

    const isCompleted = (stepId: AppStep) => {
        const order: AppStep[] = ['configuration', 'characters', 'generation', 'comic'];
        return order.indexOf(currentStep) > order.indexOf(stepId);
    };

    return (
        <header className="app-header">
            <h1><IconSparkles /> AI Comic Creator</h1>
            <p>Create stunning comic book pages with AI</p>
            <nav className="stepper">
                {steps.map(step => (
                    <div key={step.id} className={`step ${currentStep === step.id ? 'active' : ''} ${isCompleted(step.id as AppStep) ? 'completed' : ''}`}>
                        <div className="step-icon">{isCompleted(step.id as AppStep) ? <IconCheck /> : step.icon}</div>
                        <span className="step-label">{step.label}</span>
                    </div>
                ))}
            </nav>
        </header>
    );
};

const ConfigurationStep = ({ config, setConfig, onNext, apiKey, setApiKey }) => {
    const handleInputChange = (e) => {
        const { name, value, type } = e.target;
        setConfig(prev => ({ ...prev, [name]: type === 'number' ? parseInt(value, 10) : value }));
    };
    
    const isNextDisabled = !apiKey.trim() || !config.storyScript.trim() || !config.artStyle || !config.comicEra;

    return (
        <div className="step-container">
            <div className="step-header">
                <IconCog />
                <h2>Configuration</h2>
            </div>
            
            <div className="form-group full-width" style={{background: 'var(--primary-glow)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1.5rem'}}>
                <label htmlFor="apiKey">Gemini API Key</label>
                <input
                    type="password"
                    id="apiKey"
                    name="apiKey"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your Gemini API Key to begin"
                />
                <p className="form-note">Your API Key is only stored in your browser for this session.</p>
            </div>

            <div className="form-group full-width">
                <label htmlFor="storyScript">Story Script</label>
                <textarea
                    id="storyScript"
                    name="storyScript"
                    value={config.storyScript}
                    onChange={handleInputChange}
                    placeholder="Enter your story script here... Describe the plot, characters, and scenes you want to turn into a comic."
                />
            </div>
             <div className="form-group full-width">
                <label htmlFor="additionalInstructions">Additional Instructions (Optional)</label>
                <textarea
                    id="additionalInstructions"
                    name="additionalInstructions"
                    value={config.additionalInstructions}
                    onChange={handleInputChange}
                    placeholder="Provide any extra instructions for the AI, e.g., 'All characters should be wearing futuristic armor', 'The mood should be dark and gritty', 'Use a specific color palette'."
                />
            </div>
            <div className="form-grid">
                <div className="form-group">
                    <label>Text Generation Model</label>
                     <select name="textModel" value={config.textModel} onChange={handleInputChange}>
                        {textModels.map(model => (
                            <option key={model.id} value={model.id}>{model.name}</option>
                        ))}
                    </select>
                </div>
                 <div className="form-group">
                    <label>Image Generation Model</label>
                    <select name="imageModel" value={config.imageModel} onChange={handleInputChange}>
                       {imageModels.map(model => (
                            <option key={model.id} value={model.id}>{model.name}</option>
                        ))}
                    </select>
                </div>
                 <div className="form-group">
                    <label>Visual Style</label>
                    <select name="artStyle" value={config.artStyle} onChange={handleInputChange}>
                        <option value="">Select art style</option>
                        <option value="Photo Realism">Photo Realism</option>
                        <option value="Anime">Anime</option>
                        <option value="American Realism">American Realism</option>
                        <option value="Manga">Manga</option>
                        <option value="Cartoon">Cartoon</option>
                        <option value="Pixel Art">Pixel Art</option>
                    </select>
                    <select name="comicEra" value={config.comicEra} onChange={handleInputChange}>
                        <option value="">Select comic era</option>
                        <option value="Golden Age (1930s-50s)">Golden Age (1930s-50s)</option>
                        <option value="Silver Age (1950s-70s)">Silver Age (1950s-70s)</option>
                        <option value="Bronze Age (1970s-80s)">Bronze Age (1970s-80s)</option>
                        <option value="Modern Age (1980s-present)">Modern Age (1980s-present)</option>
                    </select>
                </div>
                 <div className="form-group">
                    <label>Aspect Ratio</label>
                    <select name="aspectRatio" value={config.aspectRatio} onChange={handleInputChange}>
                        <option value="16:9">16:9 (Widescreen)</option>
                        <option value="1:1">1:1 (Square)</option>
                        <option value="4:5">4:5 (Portrait)</option>
                        <option value="9:16">9:16 (Tall)</option>
                    </select>
                </div>
                <div className="form-group">
                    <label htmlFor="pages">Number of Pages</label>
                    <input 
                        type="number" 
                        id="pages" 
                        name="pages" 
                        value={config.pages} 
                        onChange={handleInputChange} 
                        min="1" 
                        max="200"
                    />
                </div>
                 <div className="form-group">
                    <label htmlFor="seed">Random Seed (Optional)</label>
                    <input type="text" id="seed" name="seed" value={config.seed} onChange={handleInputChange} placeholder="Leave empty for random"/>
                </div>
            </div>
            <div className="button-group">
                <span></span>
                <button className="button button-primary" onClick={onNext} disabled={isNextDisabled}>
                    Continue to Character Setup
                </button>
            </div>
        </div>
    );
};

const CharactersStep = ({ characters, setCharacters, onBack, onNext }) => {

    const addCharacter = () => {
        setCharacters(prev => [...prev, { id: Date.now().toString(), name: '', description: '', referenceImages: [] }]);
    };
    
    const updateCharacter = (id: string, field: 'name' | 'description', value: string) => {
        setCharacters(prev => prev.map(char => char.id === id ? { ...char, [field]: value } : char));
    };

    const handleImageUpload = async (id: string, files: FileList | null) => {
        if (!files) return;

        const imagePromises = Array.from(files).map(async (file: File) => ({
            file,
            base64: await fileToBase64(file),
        }));
        const newImages = await Promise.all(imagePromises);
        
        setCharacters(prev => prev.map(char => {
            if (char.id === id) {
                return { ...char, referenceImages: [...char.referenceImages, ...newImages] };
            }
            return char;
        }));
    };

    useEffect(() => {
      if (characters.length === 0) {
        addCharacter();
      }
    }, [characters.length]);
    

    return (
        <div className="step-container">
            <div className="step-header">
                <IconPeople />
                <div>
                    <h2>Character Setup</h2>
                    <p>Define your characters and upload reference images for consistency across panels.</p>
                     <p className="form-note" style={{marginTop: '0.5rem'}}>
                        <strong>Pro Tip:</strong> Providing at least one clear reference image per character is the best way to prevent the AI from mixing up their appearances.
                    </p>
                </div>
            </div>

            {characters.map(char => (
                <div key={char.id} className="character-card">
                    <div className="form-group">
                        <label>Character Name</label>
                        <input type="text" placeholder="Enter character name" value={char.name} onChange={(e) => updateCharacter(char.id, 'name', e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label>Description (Optional)</label>
                        <textarea placeholder="Describe the character's appearance, personality, etc." value={char.description} onChange={(e) => updateCharacter(char.id, 'description', e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label>Reference Images (Optional)</label>
                        <input type="file" id={`file-input-${char.id}`} multiple accept="image/png, image/jpeg" style={{ display: 'none' }} onChange={(e) => handleImageUpload(char.id, e.target.files)} />
                        <label htmlFor={`file-input-${char.id}`} className="file-uploader">
                            <IconUpload />
                            <strong>Click to upload reference images</strong>
                            <p>PNG, JPG up to 10MB each</p>
                        </label>
                        <div className="image-previews">
                            {char.referenceImages.map(img => (
                                <div key={img.base64.substring(20, 50)} className="image-preview">
                                    <img src={img.base64} alt="Reference" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ))}
            
            <button className="button button-secondary" onClick={addCharacter}>+ Add Character</button>

            <div className="button-group">
                 <button className="button button-secondary" onClick={onBack}>
                    Back to Configuration
                </button>
                <button className="button button-primary" onClick={onNext}>
                    Continue to Generation
                </button>
            </div>
        </div>
    );
};

const GenerationStep = ({ progress, panels, config }) => {
    const stages: {id: GenerationStage, text: string, subtext: string}[] = [
        { id: 'story', text: "Story & Panel Breakdown", subtext: "AI analyzes script and divides it into panels." },
        { id: 'images', text: "Image Generation", subtext: "AI generates artwork for each panel." },
        { id: 'assembly', text: "Final Assembly", subtext: "Panels are compiled into the final comic." },
    ];
    const stageOrder: GenerationStage[] = ['story', 'images', 'assembly'];
    
    const getStageStatus = (stageId: GenerationStage) => {
        const currentIndex = stageOrder.indexOf(progress.stage);
        const stageIndex = stageOrder.indexOf(stageId);
        if (stageIndex < currentIndex) return 'completed';
        if (stageIndex === currentIndex) return 'active';
        return 'pending';
    };

    return (
        <div className="generation-container">
            <div className="step-header" style={{ justifyContent: 'center' }}>
                <IconPencil />
                <h2>Generating Your Comic</h2>
            </div>
            <p>Progress: {Math.round(progress.percentage)}%</p>
            <div className="progress-bar-container">
                <div className="progress-bar" style={{ width: `${progress.percentage}%` }}></div>
            </div>

            <div className="generation-stage">
                <IconSpinner />
                <span><strong>Current Stage:</strong> {progress.message}</span>
            </div>

            <div className="generation-process-list">
                {stages.map((stage, index) => (
                     <div key={stage.id} className={`process-item ${getStageStatus(stage.id) === 'active' ? 'active' : ''} ${getStageStatus(stage.id) === 'completed' ? 'completed' : ''}`}>
                        <div className="icon">
                            {getStageStatus(stage.id) === 'completed' ? <IconCheck /> : (getStageStatus(stage.id) === 'active' ? <IconSpinner /> : <span style={{ opacity: 0.5 }}>{index + 1}</span>) }
                        </div>
                        <div>
                            <strong>{stage.text}</strong>
                            <p style={{ color: "var(--secondary-text)", fontSize: "0.9em"}}>{stage.subtext}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="live-preview-container">
                <h3>Live Preview</h3>
                {panels.length > 0 ? (
                    <div className="comic-grid">
                        {panels.map((panel, index) => (
                            <div key={panel.id} className="comic-panel">
                                <div className="panel-image-container" style={{ aspectRatio: config.aspectRatio.replace(':', ' / ') }}>
                                    {panel.status === 'done' && panel.imageUrl ? (
                                        <img src={panel.imageUrl} alt={`Panel ${panel.panel}`} />
                                    ) : panel.status === 'error' ? (
                                        <div className="panel-error">
                                            <IconError />
                                            <span>Image generation failed.</span>
                                        </div>
                                    ) : (
                                        <div className="panel-image-container">
                                            <IconSpinner />
                                            <span>Generating...</span>
                                        </div>
                                    )}
                                </div>
                                <div className="panel-text">
                                   {panel.panelText || "..."}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="preview-placeholder">
                        <IconPencil />
                        <p>The AI is warming up... Your comic panels will appear here as they are created.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const ComicViewStep = ({ panels, config, onRestart }) => {
    const [showDescriptions, setShowDescriptions] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);

    const downloadComic = async () => {
        setIsDownloading(true);
        const pageElements = document.querySelectorAll('.comic-page-container');
        if (pageElements.length === 0) {
            alert("No pages found to download.");
            setIsDownloading(false);
            return;
        }

        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'px',
            format: 'a4',
        });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        const pageBackgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--container-bg').trim();

        for (let i = 0; i < pageElements.length; i++) {
            const pageElement = pageElements[i] as HTMLElement;
            const canvas = await html2canvas(pageElement, {
                scale: 2,
                useCORS: true,
                backgroundColor: pageBackgroundColor,
            });

            const imgData = canvas.toDataURL('image/png');
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);

            const imgX = (pdfWidth - imgWidth * ratio) / 2;
            const imgY = 0;
            
            if (i > 0) {
                pdf.addPage();
            }
            pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
        }
        
        pdf.save('ai-comic.pdf');
        setIsDownloading(false);
    };
    
    const successfulPanels = useMemo(() => panels.filter(p => p.status === 'done' && p.imageUrl).length, [panels]);
    const failedPanels = useMemo(() => panels.filter(p => p.status === 'error').length, [panels]);

    const pages = useMemo(() => {
        if (!panels || panels.length === 0) return {};
        return panels.reduce((acc, panel) => {
            const pageNum = panel.page || 1;
            if (!acc[pageNum]) {
                acc[pageNum] = [];
            }
            acc[pageNum].push(panel);
            acc[pageNum].sort((a,b) => a.panel - b.panel);
            return acc;
        }, {});
    }, [panels]);


    return (
        <div className="step-container">
            <div className="comic-header">
                <div className="step-header" style={{marginBottom: 0}}>
                    <IconBook />
                    <h2>Your Comic Is Ready!</h2>
                </div>
                <div className="comic-actions">
                     <div className="toggle-switch">
                        <label htmlFor="show-desc">Show descriptions</label>
                        <label className="switch">
                            <input id="show-desc" type="checkbox" checked={showDescriptions} onChange={() => setShowDescriptions(p => !p)} />
                            <span className="slider"></span>
                        </label>
                    </div>
                    <button className="button button-secondary" onClick={downloadComic} disabled={isDownloading}>
                        {isDownloading ? <><IconSpinner/> Generating...</> : 'Download as PDF'}
                    </button>
                    <button className="button button-primary" onClick={onRestart}>Create New Comic</button>
                </div>
            </div>
            
            <div id="comic-download-area">
                {Object.keys(pages).sort((a,b) => parseInt(a) - parseInt(b)).map(pageNum => (
                    <div key={`page-container-${pageNum}`} className="comic-page-container">
                        <h3 className="page-header">Page {pageNum}</h3>
                        <div className="comic-grid">
                            {pages[pageNum].map((panel) => (
                                <div key={panel.id} className="comic-panel">
                                    <div className="panel-image-container" style={{ aspectRatio: config.aspectRatio.replace(':', ' / ') }}>
                                        {panel.status === 'done' && panel.imageUrl ? (
                                            <img src={panel.imageUrl} alt={`Page ${panel.page}, Panel ${panel.panel}`} crossOrigin="anonymous" />
                                        ) : panel.status === 'error' ? (
                                            <div className="panel-error">
                                                <IconError />
                                                <span>Image generation failed.</span>
                                            </div>
                                        ) : (
                                            <div className="panel-image-container">
                                                <IconSpinner />
                                                <span>Generating...</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="panel-text">
                                    {panel.panelText || "..."}
                                    </div>
                                    {showDescriptions && (
                                        <div className="panel-description">
                                            {panel.sceneDescription || "..."}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="comic-stats">
                <div className="stat-item">
                    <div className="value">{config.pages}</div>
                    <div className="label">Pages</div>
                </div>
                 <div className="stat-item">
                    <div className="value">{panels.length}</div>
                    <div className="label">Total Panels</div>
                </div>
                <div className="stat-item">
                    <div className="value">{successfulPanels}</div>
                    <div className="label">Successful Panels</div>
                </div>
                <div className="stat-item">
                    <div className="value">{failedPanels}</div>
                    <div className="label">Failed Panels</div>
                </div>
            </div>
        </div>
    );
};


const App = () => {
    const [apiKey, setApiKey] = useState(process.env.API_KEY || '');
    const [appStep, setAppStep] = useState<AppStep>('configuration');
    const [error, setError] = useState<string | null>(null);

    const [config, setConfig] = useState<Config>({
        storyScript: '',
        textModel: 'gemini-2.5-flash',
        imageModel: 'imagen-3.0-generate-002',
        aspectRatio: '16:9',
        pages: 1,
        seed: '',
        artStyle: '',
        comicEra: '',
        additionalInstructions: '',
    });

    const [characters, setCharacters] = useState<Character[]>([]);
    const [comicPanels, setComicPanels] = useState<ComicPanel[]>([]);

    const [progress, setProgress] = useState<GenerationProgress>({
        stage: 'idle',
        message: 'Waiting to start...',
        percentage: 0,
    });
    
    const ai = useMemo(() => {
        if (!apiKey) return null;
        try {
            return new GoogleGenAI({ apiKey });
        } catch(e) {
            console.error(e);
            setError("Failed to initialize AI. Check API Key configuration.");
            return null;
        }
    }, [apiKey]);
    
    const handleReset = () => {
        setAppStep('configuration');
        setComicPanels([]);
        setProgress({ stage: 'idle', message: 'Waiting to start...', percentage: 0 });
        setError(null);
        setConfig(prev => ({...prev, storyScript: '', pages: 1, artStyle: '', comicEra: '', additionalInstructions: ''}));
        setCharacters([]);
    };

    const generateWithImagenModels = useCallback(async () => {
        if (!ai) return;
        // --- STAGE 1: STORY BREAKDOWN ---
        setProgress({ stage: 'story', message: 'Analyzing story script...', percentage: 0 });
        
        const characterDescriptions = characters
            .filter(c => c.name.trim())
            .map(c => `- ${c.name}: ${c.description || 'No description provided.'}`)
            .join('\n');
            
        const additionalInstructionsText = config.additionalInstructions ? `\n\nADDITIONAL INSTRUCTIONS:\n${config.additionalInstructions}` : '';

        const systemInstruction = `You are a comic book scriptwriter. Your task is to take a story script and break it down into distinct comic book panels across ${config.pages} page(s).
Each panel must be assigned a "page" number and a "panel" number (which resets for each page). Each panel must have a "sceneDescription" for the artist and "panelText" for the narrator or dialogue.
Pace the story appropriately across the requested number of pages.
Characters:
${characterDescriptions || "No specific characters defined."}
Art Style Guidelines:
- Style: ${config.artStyle}
- Era: ${config.comicEra}
Quality Requirements:
- Create professional, clean, and coherent comic art.
- Pay close attention to anatomy. Figures should be anatomically correct and well-proportioned.
- Hands should be well-formed with the correct number of fingers.
- Faces must be clear, expressive, and symmetrical. Avoid distorted features.
Negative Prompts (what to avoid):
- Avoid disfigured, deformed, or mutated body parts. No amputees unless specified in the script.
- Avoid extra or missing limbs/fingers.
- Avoid blurry, noisy, or low-quality images.
- Avoid text, watermarks, or signatures in the image.
Output a valid JSON array of objects, where each object represents a panel and has the following structure: { "page": number, "panel": number, "sceneDescription": string, "panelText": string }.
Ensure the "sceneDescription" is very detailed and visual for the image generation model. Describe characters, setting, actions, and mood.
Ensure the "panelText" is concise, suitable for a comic book panel. It can be narration or dialogue. If dialogue, prefix with character name (e.g., "HERO: I'll save you!").
The output must be only the JSON array, without any markdown formatting.${additionalInstructionsText}`;

        let parsedPanels: Omit<ComicPanel, 'id' | 'status' | 'imageUrl'>[] = [];
        try {
            const response = await ai.models.generateContent({
                model: config.textModel,
                contents: `Generate a comic script breakdown for the following story: ${config.storyScript}`,
                config: {
                    systemInstruction,
                    responseMimeType: "application/json",
                }
            });

            setProgress({ stage: 'story', message: 'Parsing story structure...', percentage: 15 });
            
            let jsonStr = response.text.trim();
            const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
            const match = jsonStr.match(fenceRegex);
            if (match && match[2]) {
                jsonStr = match[2].trim();
            }
            parsedPanels = JSON.parse(jsonStr);
            if (!Array.isArray(parsedPanels) || !parsedPanels.every(p => 'page' in p && 'panel' in p && 'sceneDescription' in p && 'panelText' in p)) {
                throw new Error("Invalid panel structure received from AI. The response was not a valid array of panels with page numbers.");
            }
            
            const initialPanels = parsedPanels.map((p, i) => ({ ...p, id: i, status: 'pending' as const, imageUrl: undefined }));
            setComicPanels(initialPanels);

            // --- STAGE 2: IMAGE GENERATION ---
            setProgress({ stage: 'images', message: 'Generating panel images...', percentage: 20 });
            
            const totalPanels = initialPanels.length;
            for (let i = 0; i < totalPanels; i++) {
                const panel = initialPanels[i];
                
                setComicPanels(prev => prev.map(p => p.id === panel.id ? { ...p, status: 'generating' } : p));
                 setProgress(prev => ({
                    ...prev,
                    message: `Generating image for panel ${panel.panel} on page ${panel.page}...`,
                }));
                
                // Reinforce character identity in the text prompt for Imagen models
                const reinforcedCharacterDescriptions = characters
                    .filter(c => c.name.trim())
                    .map(c => `Crucially, when drawing "${c.name}", ensure they match their description: ${c.description || 'No description provided.'}`)
                    .join('\n');

                const imagePrompt = `Comic book panel in a ${config.artStyle} style, reminiscent of the ${config.comicEra}.
Scene: ${panel.sceneDescription}.
${reinforcedCharacterDescriptions}
Aspect ratio: ${config.aspectRatio}.
Quality Requirements:
- Create professional, clean, and coherent comic art.
- Pay close attention to anatomy. Figures should be anatomically correct and well-proportioned.
- Hands should be well-formed with the correct number of fingers.
- Faces must be clear, expressive, and symmetrical. Avoid distorted features.
Negative Prompts (what to avoid):
- Avoid disfigured, deformed, or mutated body parts. No amputees unless specified in the script.
- Avoid extra or missing limbs/fingers.
- Avoid blurry, noisy, or low-quality images.
- Avoid text, watermarks, or signatures in the image.${additionalInstructionsText}`;
                
                try {
                     const imageResponse = await ai.models.generateImages({
                        model: config.imageModel,
                        prompt: imagePrompt,
                        config: { 
                            numberOfImages: 1,
                            outputMimeType: 'image/jpeg',
                            seed: config.seed ? parseInt(config.seed, 10) : undefined,
                        },
                    });
    
                    if (imageResponse.generatedImages && imageResponse.generatedImages.length > 0) {
                        const base64ImageBytes = imageResponse.generatedImages[0].image.imageBytes;
                        const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
                        setComicPanels(prev => prev.map(p => p.id === panel.id ? { ...p, status: 'done', imageUrl } : p));
                    } else {
                        throw new Error("API returned no images.");
                    }
                } catch (e) {
                    console.error(`Image generation failed for panel ${panel.panel}:`, e);
                    setComicPanels(prev => prev.map(p => p.id === panel.id ? { ...p, status: 'error' } : p));
                }
    
                setProgress(prev => ({
                    ...prev,
                    percentage: 20 + ((i + 1) / totalPanels) * 75,
                }));
            }
        } catch (e) {
            console.error("Story generation failed:", e);
            setError(`Story generation failed: ${e.message}`);
            setAppStep('configuration');
            return;
        }
    }, [ai, config, characters]);
    
    const generateWithChatModel = useCallback(async () => {
        if (!ai) return;

        // --- STAGE 1: BREAK STORY INTO PAGE SUMMARIES ---
        setProgress({ stage: 'story', message: 'Breaking story into pages...', percentage: 0 });
            
        const additionalInstructionsText = config.additionalInstructions ? `\n\nADDITIONAL INSTRUCTIONS:\n${config.additionalInstructions}` : '';

        const pageBreakdownPrompt = `You are a screenwriting assistant. Your task is to take a long story script and divide it into a series of smaller, self-contained page summaries for a comic book. The user will specify the total number of pages. You must divide the story's plot points, dialogue, and action evenly and logically across the requested number of pages. For each page, provide a concise but detailed summary of the events, character actions, and key dialogue that should occur on that page. Your output must be a valid JSON array of strings, where each string is the summary for one page. The array must have exactly ${config.pages} elements.${additionalInstructionsText}`;

        let pageSummaries: string[] = [];

        try {
            const response = await ai.models.generateContent({
                model: config.textModel,
                contents: `Story: "${config.storyScript}". Break this into ${config.pages} page(s).`,
                config: {
                    systemInstruction: pageBreakdownPrompt,
                    responseMimeType: "application/json",
                }
            });
            
            setProgress({ stage: 'story', message: 'Parsing page structure...', percentage: 5 });

            let jsonStr = response.text.trim();
            const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
            const match = jsonStr.match(fenceRegex);
            if (match && match[2]) {
                jsonStr = match[2].trim();
            }
            const parsedData = JSON.parse(jsonStr);

            if (!Array.isArray(parsedData) || parsedData.some(item => typeof item !== 'string')) {
                throw new Error("AI did not return a valid array of page summary strings.");
            }
            pageSummaries = parsedData;

        } catch (e) {
            console.error("Page breakdown failed:", e);
            setError(`Failed to break down story into pages: ${e.message}`);
            setAppStep('configuration');
            return;
        }

        setProgress({ stage: 'images', message: 'Starting image generation...', percentage: 10 });
        setComicPanels([]);
        let panelIdCounter = 0;

        // --- STAGE 2: GENERATE EACH PAGE ---
        for (let i = 0; i < pageSummaries.length; i++) {
            const currentPageSummary = pageSummaries[i];
            const currentPageNumber = i + 1;

            setProgress(prev => ({ 
                ...prev,
                stage: 'images', 
                message: `Generating panels for page ${currentPageNumber}...`,
                percentage: 10 + (i / pageSummaries.length) * 85
            }));

            const pageInstructions = `You are an AI Comic Creator. Your task is to generate a comic page based on a page summary and character reference images. For each panel on this page, you must do two things in order:
1. First, on its own line(s), write the panel's text (dialogue or narration).
2. Second, on the lines immediately following, write a detailed scene description for the artist that will be used to generate the image.
3. Finally, and most importantly, generate the image for that panel based on the description you just wrote.

The art style must be: ${config.artStyle}, from the ${config.comicEra}.
The aspect ratio for images must be ${config.aspectRatio}.
It is ESSENTIAL to use the provided character reference images. When a character is mentioned, you MUST draw them to look exactly like their reference photo. Do not mix features between characters.

Quality Requirements for Images:
- Create professional, clean, and coherent comic art.
- Pay close attention to anatomy. Figures should be anatomically correct and well-proportioned.
- Hands should be well-formed with the correct number of fingers.
- Faces must be clear, expressive, and symmetrical. Avoid distorted features.
Negative Prompts for Images (what to avoid):
- Avoid disfigured, deformed, or mutated body parts. No amputees unless specified in the script.
- Avoid extra or missing limbs/fingers.
- Avoid blurry, noisy, or low-quality images.
- Avoid text, watermarks, or signatures in the image.

Repeat this process for all panels needed to tell the story for this page. Do not add any other text, titles, or commentary. Just start with the text for the first panel of this page.`;

            try {
                const chat: Chat = ai.chats.create({
                    model: 'gemini-2.0-flash-preview-image-generation',
                    history: [],
                    config: {
                        responseModalities: ["TEXT", "IMAGE"],
                    } as any,
                });

                // **NEW: Structured Prompt with Interleaved Images**
                const promptParts: Part[] = [];

                // 1. Add character references first, creating a strong link.
                promptParts.push({ text: "First, here are the character references you must use." });
                for (const character of characters) {
                    if (character.name && character.referenceImages.length > 0) {
                        promptParts.push({ text: `This is the reference for "${character.name}". Description: ${character.description || 'N/A'}` });
                        for (const image of character.referenceImages) {
                            promptParts.push({
                                inlineData: {
                                    mimeType: image.file.type,
                                    data: image.base64.split(',')[1],
                                }
                            });
                        }
                    }
                }
                
                // 2. Add the main instructions and page summary
                const mainPromptText = `${pageInstructions}
---
PAGE ${currentPageNumber} SUMMARY:
${currentPageSummary}
---
${additionalInstructionsText}`;

                promptParts.push({ text: mainPromptText });

                const result = await chat.sendMessageStream({ message: promptParts });

                let textBuffer = '';
                let panelCountForPage = 1;

                for await (const chunk of result) {
                    const parts = chunk.candidates?.[0]?.content?.parts;
                    if (!parts) continue;
                    
                    for(const part of parts) {
                        if (part.text) {
                            textBuffer += part.text;
                        } else if (part.inlineData) {
                            const data = part.inlineData.data;
                            const imageUrl = `data:image/png;base64,${data}`;
    
                            const lines = textBuffer.trim().split('\n');
                            const panelText = lines[0] || '...';
                            const sceneDescription = lines.slice(1).join('\n').trim() || 'AI generated scene.';
    
                            const newPanel: ComicPanel = {
                                id: panelIdCounter++,
                                page: currentPageNumber,
                                panel: panelCountForPage++,
                                panelText,
                                sceneDescription,
                                imageUrl,
                                status: 'done'
                            };
                            
                            setComicPanels(prev => [...prev, newPanel]);
                            textBuffer = '';
                        }
                    }
                }
            } catch(e) {
                console.error(`Native image generation failed for page ${currentPageNumber}:`, e);
                setError(`Generation failed on page ${currentPageNumber}: ${e.message}. The comic may be incomplete.`);
                setAppStep('comic'); // Go to comic view to show what has been done.
                return;
            }
        }
    }, [ai, config, characters]);


    const generateComic = useCallback(async () => {
        if (!ai) {
            setError("AI Client not initialized. Please enter a valid API Key in the configuration step.");
            setAppStep('configuration');
            return;
        }
        setError(null);
        setAppStep('generation');
        setComicPanels([]);

        if (config.imageModel === 'gemini-2.0-flash-preview-image-generation') {
            await generateWithChatModel();
        } else {
            await generateWithImagenModels();
        }

        // --- STAGE 3: ASSEMBLY ---
        setProgress({ stage: 'assembly', message: 'Assembling comic...', percentage: 99 });
        setTimeout(() => {
            setProgress({ stage: 'done', message: 'Complete!', percentage: 100 });
            setAppStep('comic');
        }, 500);

    }, [ai, config, characters, generateWithImagenModels, generateWithChatModel]);
    
    useEffect(() => {
        if (appStep === 'generation') {
            generateComic();
        }
    }, [appStep, generateComic]);

    const renderStep = () => {
        switch (appStep) {
            case 'configuration':
                return <ConfigurationStep config={config} setConfig={setConfig} onNext={() => setAppStep('characters')} apiKey={apiKey} setApiKey={setApiKey} />;
            case 'characters':
                return <CharactersStep characters={characters} setCharacters={setCharacters} onBack={() => setAppStep('configuration')} onNext={() => setAppStep('generation')} />;
            case 'generation':
                return <GenerationStep progress={progress} panels={comicPanels} config={config} />;
            case 'comic':
                return <ComicViewStep panels={comicPanels} config={config} onRestart={handleReset} />;
            default:
                return <div>Loading...</div>;
        }
    };

    return (
        <div className="app-container">
            <Header currentStep={appStep} />
            <main className="main-content">
                {error && <div className="error-message"><IconError/> {error}</div>}
                {renderStep()}
            </main>
        </div>
    );
};

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
}
