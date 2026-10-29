//! Package-relative paths used by clickable links in local project descriptions.
//!
//! Kept independent of Tauri so path and symlink boundaries can be tested without
//! loading MaaFramework or opening any files with their associated application.

use std::path::{Path, PathBuf};

/// Resolve an already URI-decoded path beneath the executable directory.
/// A link is a path, never a command line: callers cannot supply an application,
/// arguments, URI scheme, drive, network share or parent-directory traversal.
pub(super) fn resolve_local_link(root: &Path, relative_path: &str) -> Result<PathBuf, String> {
    if relative_path.is_empty()
        || relative_path.len() > 32_767
        || relative_path.chars().any(|c| c.is_control())
        || relative_path.starts_with(['/', '\\'])
        || relative_path.contains([':', '"', '<', '>', '|', '*', '?', '#'])
    {
        return Err("LOCAL_LINK_INVALID".into());
    }

    // Check both separator styles even on Unix, so a Windows resource has the
    // same meaning and safety boundary when inspected on another platform.
    let normalized = relative_path.replace('\\', "/");
    let normalized = normalized.strip_prefix("./").unwrap_or(&normalized);
    if normalized.is_empty()
        || normalized.split('/').any(|part| {
            part.is_empty() || part == "." || part == ".." || part.ends_with([' ', '.'])
        })
    {
        return Err("LOCAL_LINK_INVALID".into());
    }

    let root = root
        .canonicalize()
        .map_err(|_| "LOCAL_LINK_NOT_FOUND".to_string())?;
    let target = root
        .join(normalized)
        .canonicalize()
        .map_err(|_| "LOCAL_LINK_NOT_FOUND".to_string())?;

    // Component-aware comparison also rejects sibling paths with a shared name
    // prefix. Canonicalization resolves symbolic links and Windows junctions.
    if !target.starts_with(&root) {
        return Err("LOCAL_LINK_OUTSIDE_ROOT".into());
    }
    if !target.is_file() && !target.is_dir() {
        return Err("LOCAL_LINK_INVALID".into());
    }
    Ok(target)
}

#[cfg(test)]
mod tests {
    use super::resolve_local_link;
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::sync::atomic::{AtomicU64, Ordering};

    static NEXT_TEMP: AtomicU64 = AtomicU64::new(0);

    struct Fixture(PathBuf);

    impl Fixture {
        fn new() -> Self {
            let dir = std::env::temp_dir().join(format!(
                "mxu-local-link-{}-{}-中文 空格",
                std::process::id(),
                NEXT_TEMP.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir(&dir).unwrap();
            fs::create_dir_all(dir.join("package/docs")).unwrap();
            fs::write(dir.join("package/打开 编队编辑器.cmd"), b"@echo off\r\n").unwrap();
            fs::write(dir.join("package/docs/help.md"), b"help").unwrap();
            fs::create_dir_all(dir.join("package-extra")).unwrap();
            fs::write(dir.join("package-extra/outside.txt"), b"outside").unwrap();
            Self(dir)
        }

        fn root(&self) -> PathBuf {
            self.0.join("package")
        }
    }

    impl Drop for Fixture {
        fn drop(&mut self) {
            // Only our freshly allocated per-process temporary directory. Remove
            // the test's junction/symlink first even when an assertion panics.
            if self.0.parent() != Some(std::env::temp_dir().as_path()) {
                return;
            }
            let outside_link = self.root().join("outside");
            if fs::symlink_metadata(&outside_link).is_ok() {
                if outside_link.is_symlink() {
                    let _ = fs::remove_file(&outside_link);
                } else {
                    let _ = fs::remove_dir(&outside_link);
                }
            }
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn resolves_unicode_spaces_and_directories() {
        let fixture = Fixture::new();
        let root = fixture.root();
        assert_eq!(
            resolve_local_link(&root, "./打开 编队编辑器.cmd").unwrap(),
            root.join("打开 编队编辑器.cmd").canonicalize().unwrap()
        );
        assert_eq!(
            resolve_local_link(&root, "./docs").unwrap(),
            root.join("docs").canonicalize().unwrap()
        );
        assert_eq!(
            resolve_local_link(&root, "docs\\help.md").unwrap(),
            root.join("docs/help.md").canonicalize().unwrap()
        );
    }

    #[test]
    fn rejects_paths_before_filesystem_access() {
        for path in [
            "",
            "/etc/passwd",
            "\\Windows\\System32",
            "C:/Windows",
            "C:relative",
            "//host/share/file",
            "\\\\host\\share\\file",
            "file:///C:/test",
            "https://example.com",
            "../outside.txt",
            "./docs/../../outside.txt",
            "docs\\..\\..\\outside.txt",
            "./docs/.. /outside.txt",
            "./docs/../help.md",
            "docs//help.md",
            "./",
            "./docs/./help.md",
            "./docs/help.md:stream",
            "./docs/help.md\0",
            "./docs/help.md\n",
            "./*.cmd",
            "\"file.cmd\"",
            "./docs/help.md#fragment",
            "./docs/help.md?query=value",
        ] {
            assert_eq!(
                resolve_local_link(Path::new("nonexistent-root"), path).unwrap_err(),
                "LOCAL_LINK_INVALID",
                "{path:?}"
            );
        }
    }

    #[test]
    fn missing_paths_do_not_launch_an_application() {
        let fixture = Fixture::new();
        assert_eq!(
            resolve_local_link(&fixture.root(), "./missing.cmd").unwrap_err(),
            "LOCAL_LINK_NOT_FOUND"
        );
    }

    #[test]
    fn link_paths_cannot_include_command_arguments() {
        let fixture = Fixture::new();
        assert_eq!(
            resolve_local_link(&fixture.root(), "./打开 编队编辑器.cmd --anything").unwrap_err(),
            "LOCAL_LINK_NOT_FOUND"
        );
    }

    #[test]
    fn files_with_shell_metacharacters_are_single_paths() {
        let fixture = Fixture::new();
        let name = "only & one (file) %value%.txt";
        fs::write(fixture.root().join(name), b"single file").unwrap();
        assert_eq!(
            resolve_local_link(&fixture.root(), name).unwrap(),
            fixture.root().join(name).canonicalize().unwrap()
        );
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlink_to_sibling_with_same_prefix() {
        let fixture = Fixture::new();
        std::os::unix::fs::symlink(
            fixture.0.join("package-extra"),
            fixture.root().join("outside"),
        )
        .unwrap();
        assert_eq!(
            resolve_local_link(&fixture.root(), "./outside/outside.txt").unwrap_err(),
            "LOCAL_LINK_OUTSIDE_ROOT"
        );
    }

    #[cfg(windows)]
    #[test]
    fn rejects_junction_to_sibling_with_same_prefix() {
        use std::os::windows::process::CommandExt;
        let fixture = Fixture::new();
        let junction = fixture.root().join("outside");
        // Test-only mklink: two checked temporary paths are passed as arguments.
        let result = std::process::Command::new("cmd.exe")
            .args(["/d", "/c", "mklink", "/j"])
            .arg(&junction)
            .arg(fixture.0.join("package-extra"))
            .creation_flags(0x0800_0000)
            .output()
            .unwrap();
        assert!(result.status.success(), "{:?}", result);
        assert_eq!(
            resolve_local_link(&fixture.root(), "./outside/outside.txt").unwrap_err(),
            "LOCAL_LINK_OUTSIDE_ROOT"
        );
        fs::remove_dir(&junction).unwrap();
    }
}
