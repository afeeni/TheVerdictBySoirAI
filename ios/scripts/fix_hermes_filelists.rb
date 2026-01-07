#!/usr/bin/env ruby
# Ensures the Hermes embed script input file lists point at the Pods-root XCFramework.
require 'pathname'

ROOT = Pathname.new(__dir__).join('..', 'Pods', 'Target Support Files').expand_path
HERMES_SLICES = %w[
  ios-arm64
  ios-arm64_x86_64-simulator
  ios-arm64_x86_64-maccatalyst
  tvos-arm64
  tvos-arm64_x86_64-simulator
  xros-arm64
  xros-arm64_x86_64-simulator
].freeze

def hermes_entries
  HERMES_SLICES.flat_map do |slice|
    framework_dir = "${PODS_ROOT}/hermes-engine/destroot/Library/Frameworks/universal/hermesvm.xcframework/#{slice}/hermesvm.framework"
    [framework_dir, "#{framework_dir}/hermesvm", "#{framework_dir}/Info.plist"]
  end
end

HERMES_OUTPUTS = [
  '${TARGET_BUILD_DIR}/${FRAMEWORKS_FOLDER_PATH}/hermesvm.framework',
  '${TARGET_BUILD_DIR}/${FRAMEWORKS_FOLDER_PATH}/hermesvm.framework/hermesvm',
  '${TARGET_BUILD_DIR}/${FRAMEWORKS_FOLDER_PATH}/hermesvm.framework/Info.plist'
].freeze

Dir.glob(ROOT.join('Pods-TheVerdictBySoirAI', 'Pods-TheVerdictBySoirAI-frameworks-*-input-files.xcfilelist')).each do |path|
  lines = File.readlines(path, chomp: true)
  next if lines.empty?

  lines.reject! { |line| line.include?('hermes-engine/Pre-built') }
  hermes_entries.each do |entry|
    lines << entry unless lines.include?(entry)
  end

  File.write(path, lines.join("\n") + "\n")
  puts "Updated #{path}"
end

Dir.glob(ROOT.join('Pods-TheVerdictBySoirAI', 'Pods-TheVerdictBySoirAI-frameworks-*-output-files.xcfilelist')).each do |path|
  lines = File.readlines(path, chomp: true)
  next if lines.empty?

  changed = false
  HERMES_OUTPUTS.each do |entry|
    next if lines.include?(entry)
    lines << entry
    changed = true
  end

  next unless changed

  File.write(path, lines.join("\n") + "\n")
  puts "Updated #{path}"
end
