# Simple C# to JS word converter
# Reads the C# source files and extracts word data

$wordDataCs = "C:\Users\admin\Desktop\iniglizce\EnglishLearningApp\Models\WordData.cs"
$nichePacksCs = "C:\Users\admin\Desktop\iniglizce\EnglishLearningApp\Services\NicheWordPacks.cs"

function Get-WordLines {
    param([string]$path)
    $content = Get-Content -LiteralPath $path -Raw
    $lines = $content -split "`r`n|`n"
    $inWords = $false
    $words = @()
    $braceDepth = 0
    
    foreach ($line in $lines) {
        $t = $line.Trim()
        if ($t -match 'Words\s*=\s*new\s+List<Word>\s*\{') {
            $inWords = $true
            $braceDepth = 1
            # Count braces in this line
            foreach ($ch in $t.ToCharArray()) {
                if ($ch -eq '{') { $braceDepth += 1 }
                if ($ch -eq '}') { $braceDepth -= 1 }
            }
            continue
        }
        if ($inWords) {
            foreach ($ch in $t.ToCharArray()) {
                if ($ch -eq '{') { $braceDepth += 1 }
                if ($ch -eq '}') { $braceDepth -= 1 }
            }
            if ($braceDepth -le 0) { break }
            if ($t -match 'new\(\).*') {
                $words += $t
            }
        }
    }
    return $words
}

function Convert-Word {
    param([string]$csharp)
    # Remove the trailing comma and closing brace
    $js = $csharp -replace '^\s*new\(\)\s*\{\s*', ''
    $js = $js -replace '\}\s*,?\s*$', ''
    $js = $js.Trim()
    # Replace C# field names with JS field names - longer matches first
    $replacements = @(
        @{ from = 'ExampleTurkish\s*=\s*'; to = 'exampleTurkish: ' }
        @{ from = 'Example\s*=\s*'; to = 'example: ' }
        @{ from = 'PartOfSpeech\s*=\s*'; to = 'partOfSpeech: ' }
        @{ from = 'Phonetics\s*=\s*'; to = 'phonetics: ' }
        @{ from = 'English\s*=\s*'; to = 'english: ' }
        @{ from = 'Turkish\s*=\s*'; to = 'turkish: ' }
    )
    foreach ($r in $replacements) {
        $js = $js -replace $r.from, $r.to
    }
    return "        { $js },"
}

function Get-LevelMeta {
    param([string]$content, [string]$levelName)
    
    # Find the function that contains this level
    $pattern = "(?s)(private\s+static\s+Level\s+Get\w+(Level|Pack)\(\)\s*=>\s*new\(\)\s*\{(.*?))Words\s*=\s*new"
    $match = [regex]::Match($content, $pattern)
    
    if ($match.Success) {
        $header = $match.Groups[3].Value
        $name = ""
        $desc = ""
        $color = ""
        if ($header -match 'Name\s*=\s*"(.+?)"') { $name = $matches[1] }
        if ($header -match 'Description\s*=\s*"(.+?)"') { $desc = $matches[1] }
        if ($header -match 'Color\s*=\s*"(.+?)"') { $color = $matches[1] }
        
        # Use sub-matches
        $n = [regex]::Match($header, 'Name\s*=\s*"(.+?)"')
        $d = [regex]::Match($header, 'Description\s*=\s*"(.+?)"')
        $c = [regex]::Match($header, 'Color\s*=\s*"(.+?)"')
        
        if ($n.Success) { $name = $n.Groups[1].Value }
        if ($d.Success) { $desc = $d.Groups[1].Value }
        if ($c.Success) { $color = $c.Groups[1].Value }
        
        return @{ Name = $name; Description = $desc; Color = $color }
    }
    return $null
}

function Get-Icon {
    param([string]$name)
    if ($name -like '*A1*') { return 'seedling' }
    if ($name -like '*A2*') { return 'books' }
    if ($name -like '*B1*') { return 'fire' }
    if ($name -like '*B2*') { return 'gem' }
    if ($name -like '*C1*') { return 'rocket' }
    if ($name -like '*C2*') { return 'crown' }
    if ($name -like '*Yazilimci*') { return 'laptop-code' }
    if ($name -like '*Oyuncu*') { return 'gamepad' }
    if ($name -like '*Dizi*') { return 'film' }
    return 'book-open'
}

# Read all content
$csContent = Get-Content -LiteralPath $wordDataCs -Raw
$npContent = Get-Content -LiteralPath $nichePacksCs -Raw

# Extract words from each level
$b1Words = Get-WordLines -path $wordDataCs | Select-Object -Skip 1 | Select-Object -First 1
# Actually let me read the file line-by-line to find each level
# The function above will return words from first Words = new List<Word> it finds
# I need to modify it to extract specific levels

# Since the regex parsing is unreliable, let me just hardcode the level metadata
# and use the word extraction per-level

# Let me try a different approach - extract all word blocks separately
$content = $csContent
$lines = $content -split "`r`n|`n"
$levels = @()
$currentWords = @()
$inWords = $false
$braceDepth = 0

Write-Host "Processing $($lines.Length) lines from WordData.cs..."
foreach ($line in $lines) {
    $t = $line.Trim()
    # Detect level function start
    if ($t -match 'private\s+static\s+Level\s+Get\w+(Level|Pack)\(') {
        Write-Host "  Found level method: $t"
        if ($currentWords.Count -gt 0) {
            $levels += ,@($currentWords)
            Write-Host "  Added $($currentWords.Count) words from previous level"
            $currentWords = @()
        }
        continue
    }
    if ($t -match 'Words\s*=\s*new\s+List<Word>') {
        $inWords = $true
        $braceDepth = 0
        foreach ($ch in $t.ToCharArray()) { if ($ch -eq '{') { $braceDepth += 1 }; if ($ch -eq '}') { $braceDepth -= 1 } }
        continue
    }
    if ($inWords) {
        foreach ($ch in $t.ToCharArray()) { if ($ch -eq '{') { $braceDepth += 1 }; if ($ch -eq '}') { $braceDepth -= 1 } }
        if ($braceDepth -le 0) { 
            $inWords = $false
            if ($currentWords.Count -gt 0) {
                $levels += ,@($currentWords)
                $currentWords = @()
            }
            continue 
        }
        if ($t -match 'new\(\)') {
            $currentWords += $t
        }
    }
}
if ($currentWords.Count -gt 0) {
    $levels += ,@($currentWords)
}

# Now do the same for NicheWordPacks
$content = $npContent
$lines = $content -split "`r`n|`n"
$nicheLevels = @()
$currentWords = @()
$inWords = $false
$braceDepth = 0

Write-Host "Processing $($lines.Length) lines from NicheWordPacks.cs..."
foreach ($line in $lines) {
    $t = $line.Trim()
    if ($t -match 'private\s+static\s+Level\s+Get\w+(Level|Pack)\(') {
        Write-Host "  Found pack method: $t"
        if ($currentWords.Count -gt 0) {
            $nicheLevels += ,@($currentWords)
            Write-Host "  Added $($currentWords.Count) words from previous pack"
            $currentWords = @()
        }
        continue
    }
    if ($t -match 'Words\s*=\s*new\s+List<Word>') {
        $inWords = $true
        $braceDepth = 0
        foreach ($ch in $t.ToCharArray()) { if ($ch -eq '{') { $braceDepth += 1 }; if ($ch -eq '}') { $braceDepth -= 1 } }
        continue
    }
    if ($inWords) {
        foreach ($ch in $t.ToCharArray()) { if ($ch -eq '{') { $braceDepth += 1 }; if ($ch -eq '}') { $braceDepth -= 1 } }
        if ($braceDepth -le 0) { 
            $inWords = $false
            if ($currentWords.Count -gt 0) {
                $nicheLevels += ,@($currentWords)
                Write-Host "  Added $($currentWords.Count) words from pack ending"
                $currentWords = @()
            }
            continue 
        }
        if ($t -match 'new\(\)') {
            $currentWords += $t
        }
    }
}
if ($currentWords.Count -gt 0) {
    $nicheLevels += ,@($currentWords)
    Write-Host "  Added final $($currentWords.Count) words"
}

# Define level metadata
$levelMeta = @(
    @{ Name = "A1 - Baslangic"; Description = "Temel kelime bilgisi ve basit cumleler"; Color = "#4CAF50"; Icon = "seedling" },
    @{ Name = "A2 - Temel"; Description = "Gunluk yasamda sik kullanilan kelimeler"; Color = "#2196F3"; Icon = "books" },
    @{ Name = "B1 - Orta"; Description = "Gunluk konusmalarda rahatca kullanilan kelimeler"; Color = "#FF9800"; Icon = "fire" },
    @{ Name = "B2 - Ust Orta"; Description = "Is ve akademik hayatta kullanilan kelimeler"; Color = "#E91E63"; Icon = "gem" },
    @{ Name = "C1 - Ileri"; Description = "Akademik ve profesyonel ortamlarda kullanilan kelimeler"; Color = "#9C27B0"; Icon = "rocket" },
    @{ Name = "C2 - Ustalik"; Description = "En ust duzey akademik ve edebi kelimeler"; Color = "#F44336"; Icon = "crown" },
    @{ Name = "Yazilimci Paketi"; Description = "GitHub, hata mesajlari ve teknik dokumantasyonda en cok karsilasilan 300+ kelime"; Color = "#00BCD4"; Icon = "laptop-code" },
    @{ Name = "Oyuncu Paketi"; Description = "Discord, rekabetci oyunlar ve gaming terminolojisinde en cok kullanilan 200+ kelime"; Color = "#FF5722"; Icon = "gamepad" },
    @{ Name = "Dizi/Film Paketi"; Description = "Friends, Breaking Bad, Netflix dizilerinde en cok gecen 200+ gunluk sokak Ingilizcesi"; Color = "#E91E63"; Icon = "film" }
)

# Combine all levels
$allWords = $levels + $nicheLevels

# Generate JS
$jsLines = @()
$jsLines += "const WORD_DATABASE = ["

for ($i = 0; $i -lt $allWords.Length; $i++) {
    $meta = $levelMeta[$i]
    $wordArray = $allWords[$i]
    
    $jsLines += "  {"
    $jsLines += "    name: `"$($meta.Name)`","
    $jsLines += "    description: `"$($meta.Description)`","
    $jsLines += "    color: `"$($meta.Color)`","
    $jsLines += "    icon: `"$($meta.Icon)`","
    $jsLines += "    words: ["
    
    foreach ($w in $wordArray) {
        $converted = Convert-Word -csharp $w
        if ($converted) {
            $jsLines += $converted
        }
    }
    
    $jsLines += "    ]"
    if ($i -lt $allWords.Length - 1) {
        $jsLines += "  },"
    } else {
        $jsLines += "  }"
    }
}

$jsLines += "];"

$output = $jsLines -join "`r`n"
Set-Content -LiteralPath "C:\Users\admin\Desktop\iniglizce\web\js\words-complete.js" -Value $output -Encoding UTF8
Write-Host "Done! Generated $($allWords.Length) levels"
for ($i = 0; $i -lt $allWords.Length; $i++) {
    Write-Host ("  Level " + $i + ": " + $levelMeta[$i].Name + " - " + $allWords[$i].Length + " words")
}
