import Foundation
import ImageIO
import Vision

struct TextLine: Codable {
  let text: String
  let confidence: Float
  let source: String
  let x: Double
  let y: Double
  let width: Double
  let height: Double
}

struct Output: Codable {
  let lines: [TextLine]
}

guard CommandLine.arguments.count == 2 else {
  fputs("Expected one image path\n", stderr)
  exit(2)
}

let imageURL = URL(fileURLWithPath: CommandLine.arguments[1])
let handler = VNImageRequestHandler(url: imageURL, options: [:])
var lines: [TextLine] = []

guard let source = CGImageSourceCreateWithURL(imageURL as CFURL, nil),
      let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
      let imageWidth = properties[kCGImagePropertyPixelWidth] as? Int,
      let imageHeight = properties[kCGImagePropertyPixelHeight] as? Int else {
  throw NSError(domain: "VisionOCR", code: 1, userInfo: [NSLocalizedDescriptionKey: "Could not read image dimensions"])
}

func intervals(_ length: Int) -> [(Double, Double)] {
  let target = 1300.0
  if Double(length) <= target * 1.5 { return [(0, 1)] }
  let count = min(4, Int(ceil((Double(length) - target) / (target * 0.85))) + 1)
  let size = max(target, ceil(Double(length) / (1 + Double(count - 1) * 0.85)))
  return (0..<count).map { index in
    let start = (Double(length) - size) * Double(index) / Double(count - 1)
    return (start / Double(length), size / Double(length))
  }
}

var regions: [(String, CGRect)] = [("full", CGRect(x: 0, y: 0, width: 1, height: 1))]
let xIntervals = intervals(imageWidth)
let yIntervals = intervals(imageHeight)
if xIntervals.count > 1 || yIntervals.count > 1 {
  for (row, y) in yIntervals.enumerated() {
    for (column, x) in xIntervals.enumerated() {
      regions.append(("tile-\(column)-\(row)", CGRect(x: x.0, y: y.0, width: x.1, height: y.1)))
    }
  }
}

for (name, region) in regions {
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.usesLanguageCorrection = false
  let supported = try request.supportedRecognitionLanguages()
  request.recognitionLanguages = ["en-US", "zh-Hans", "zh-Hant"].filter(supported.contains)
  request.regionOfInterest = region
  try handler.perform([request])

  for observation in request.results ?? [] {
    guard let candidate = observation.topCandidates(1).first else { continue }
    let box = observation.boundingBox
    lines.append(TextLine(
      text: candidate.string,
      confidence: candidate.confidence,
      source: name,
      x: region.minX + box.minX * region.width,
      y: region.minY + box.minY * region.height,
      width: box.width * region.width,
      height: box.height * region.height
    ))
  }
}

let data = try JSONEncoder().encode(Output(lines: lines))
FileHandle.standardOutput.write(data)
