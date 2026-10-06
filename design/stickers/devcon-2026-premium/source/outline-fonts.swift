import Foundation
import CoreText
import CoreGraphics

// Export installed font outlines once; delivered SVGs never depend on these fonts.
let fontNames = ["AvenirNext-Heavy", "AvenirNext-DemiBold", "DINCondensed-Bold"]
let characters = Array("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:;/!+-()")
var result: [String: [String: Any]] = [:]

for name in fontNames {
    let font = CTFontCreateWithName(name as CFString, 1000, nil)
    guard CTFontCopyPostScriptName(font) as String == name else {
        fatalError("Required font is missing: \(name)")
    }
    var outlines: [String: Any] = [:]
    for character in characters {
        var utf16 = Array(String(character).utf16)
        var glyphs = [CGGlyph](repeating: 0, count: utf16.count)
        guard CTFontGetGlyphsForCharacters(font, &utf16, &glyphs, utf16.count) else {
            fatalError("Missing glyph: \(character)")
        }
        var advance = CGSize.zero
        CTFontGetAdvancesForGlyphs(font, .horizontal, &glyphs, &advance, 1)
        var commands: [String] = []
        if let path = CTFontCreatePathForGlyph(font, glyphs[0], nil) {
            path.applyWithBlock { pointer in
                let element = pointer.pointee
                func point(_ i: Int) -> String {
                    String(format: "%.3f %.3f", element.points[i].x, element.points[i].y)
                }
                switch element.type {
                case .moveToPoint: commands.append("M" + point(0))
                case .addLineToPoint: commands.append("L" + point(0))
                case .addQuadCurveToPoint: commands.append("Q" + point(0) + " " + point(1))
                case .addCurveToPoint: commands.append("C" + point(0) + " " + point(1) + " " + point(2))
                case .closeSubpath: commands.append("Z")
                @unknown default: fatalError("Unsupported outline element")
                }
            }
        }
        outlines[String(character)] = ["advance": advance.width, "path": commands.joined()]
    }
    result[name] = outlines
}
let output = try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
FileHandle.standardOutput.write(output)
