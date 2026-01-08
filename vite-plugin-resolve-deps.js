import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';

/**
 * Vite plugin to resolve dependency path references in public files during build.
 * Files that contain relative paths (like ../../abc2svg/play-1.js) will have
 * their content replaced with the actual file content.
 */
export function resolveDependencyPaths() {
    let outputDir = 'dist';
    
    return {
        name: 'resolve-dependency-paths',
        enforce: 'post',
        
        configResolved(config) {
            // Store the output directory from config
            outputDir = config.build.outDir || 'dist';
        },
        
        closeBundle() {
            // This hook runs after all files are written to the output directory
            // Process files that contain path references
            const filesToCheck = [
                'play-1.js',
                'jquery.min.js',
                'jquery.mobile-1.4.5.min.js'
            ];
            
            for (const fileName of filesToCheck) {
                const filePath = join(outputDir, fileName);
                
                if (existsSync(filePath)) {
                    try {
                        const content = readFileSync(filePath, 'utf-8').trim();
                        
                        // Check if the file content is a relative path reference
                        if (content.match(/^\.\.\/\.\.\//)) {
                            const pathRef = content;
                            const fileDir = dirname(filePath);
                            const resolvedPath = resolve(fileDir, pathRef);
                            
                            // Check if the referenced file exists
                            if (existsSync(resolvedPath)) {
                                // Read the actual file content
                                const actualContent = readFileSync(resolvedPath, 'utf-8');
                                writeFileSync(filePath, actualContent, 'utf-8');
                                console.log(`✓ Resolved ${fileName}: ${pathRef} -> ${resolvedPath}`);
                            } else {
                                console.warn(`⚠ Referenced file not found: ${resolvedPath} (from ${fileName})`);
                            }
                        }
                    } catch (error) {
                        console.warn(`⚠ Failed to process ${fileName}: ${error.message}`);
                    }
                }
            }
        }
    };
}

