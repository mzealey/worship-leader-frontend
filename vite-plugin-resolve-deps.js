import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';

/**
 * Vite plugin to resolve dependency path references in public files during build and dev.
 * Files that contain relative paths (like ../../abc2svg/play-1.js) will have
 * their content replaced with the actual file content.
 */
export function resolveDependencyPaths() {
    let outputDir = 'dist';
    let rootDir = '';
    
    const filesToCheck = [
        'play-1.js',
        'jquery.min.js',
        'jquery.mobile-1.4.5.min.js'
    ];
    
    /**
     * Resolves a file that contains a path reference
     * @param {string} filePath - Path to the file that may contain a reference
     * @returns {string|null} - The resolved file content, or null if not a reference
     */
    function resolveFileContent(filePath) {
        if (!existsSync(filePath)) {
            return null;
        }
        
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
                    return actualContent;
                } else {
                    console.warn(`⚠ Referenced file not found: ${resolvedPath} (from ${filePath})`);
                    return null;
                }
            }
        } catch (error) {
            console.warn(`⚠ Failed to process ${filePath}: ${error.message}`);
            return null;
        }
        
        return null;
    }
    
    return {
        name: 'resolve-dependency-paths',
        enforce: 'pre', // Run early to intercept before static file serving
        
        configResolved(config) {
            // Store the output directory and root from config
            outputDir = config.build.outDir || 'dist';
            rootDir = config.root || '';
        },
        
        // Development mode: intercept requests and resolve on-the-fly
        configureServer(server) {
            // Add middleware early (enforce: 'pre' ensures this runs before other plugins)
            // to intercept these specific files before static file serving
            server.middlewares.use((req, res, next) => {
                const url = req.url?.split('?')[0] || ''; // Remove query params
                
                // Check if this is one of our target files (exact match or at root)
                const fileName = filesToCheck.find(name => 
                    url === `/${name}` || url === name
                );
                
                if (fileName) {
                    // Try to find the file in public directories
                    // In dev mode, build_type is 'www', so check public/all and public/www
                    const publicPaths = [
                        join(rootDir, 'public', 'all', fileName),
                        join(rootDir, 'public', 'www', fileName),
                    ];
                    
                    for (const publicPath of publicPaths) {
                        const resolvedContent = resolveFileContent(publicPath);
                        if (resolvedContent !== null) {
                            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
                            res.setHeader('Cache-Control', 'no-cache');
                            res.end(resolvedContent);
                            console.log(`✓ Resolved ${fileName} for dev server`);
                            return;
                        }
                    }
                }
                
                next();
            });
        },
        
        // Build mode: resolve files after they're written
        closeBundle() {
            for (const fileName of filesToCheck) {
                const filePath = join(outputDir, fileName);
                const resolvedContent = resolveFileContent(filePath);
                
                if (resolvedContent !== null) {
                    writeFileSync(filePath, resolvedContent, 'utf-8');
                    console.log(`✓ Resolved ${fileName} in build output`);
                }
            }
        }
    };
}

