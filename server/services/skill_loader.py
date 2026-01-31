"""Skill loader service for discovering and loading Agent Skills.

Implements the Agent Skills specification (https://agentskills.io/specification).
Skills are modular capabilities defined in Markdown files that Zeenie
can discover and use on demand.
"""

import re
import yaml
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional
from core.logging import get_logger

logger = get_logger(__name__)


@dataclass
class SkillMetadata:
    """Metadata from SKILL.md frontmatter (loaded at startup for all skills)."""
    name: str
    description: str
    allowed_tools: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    path: Optional[Path] = None  # Path to skill directory


@dataclass
class Skill:
    """Full skill content (loaded on-demand when activated)."""
    metadata: SkillMetadata
    instructions: str  # Markdown body after frontmatter
    scripts: Dict[str, str] = field(default_factory=dict)  # filename -> content
    references: Dict[str, str] = field(default_factory=dict)  # filename -> content
    assets: Dict[str, bytes] = field(default_factory=dict)  # filename -> binary content


class SkillLoader:
    """Loads and manages Agent Skills from filesystem and database.

    Skills are loaded from multiple directories with priority:
    1. Built-in skills: server/skills/
    2. Project skills: .machina/skills/ (in current directory)
    3. User skills from database (created via UI)

    Follows progressive disclosure pattern:
    - scan_skills(): Load only metadata (~100 tokens per skill)
    - load_skill(): Load full content when activated (~5000 tokens max)
    """

    def __init__(self, skill_dirs: List[Path] = None, database=None):
        """Initialize skill loader.

        Args:
            skill_dirs: List of directories to scan for skills
            database: Database instance for loading user-created skills
        """
        self._skill_dirs = skill_dirs or []
        self._database = database
        self._registry: Dict[str, SkillMetadata] = {}
        self._cache: Dict[str, Skill] = {}  # Cache loaded skills

    def scan_skills(self) -> Dict[str, SkillMetadata]:
        """Scan all skill directories and load metadata.

        Returns:
            Dict mapping skill name to SkillMetadata
        """
        self._registry.clear()

        # Scan filesystem directories
        for skill_dir in self._skill_dirs:
            if not skill_dir.exists():
                logger.debug(f"[SkillLoader] Skill directory not found: {skill_dir}")
                continue

            for skill_path in skill_dir.iterdir():
                if skill_path.is_dir():
                    skill_md = skill_path / "SKILL.md"
                    if skill_md.exists():
                        try:
                            metadata = self._parse_skill_metadata(skill_md)
                            if metadata:
                                metadata.path = skill_path
                                self._registry[metadata.name] = metadata
                                logger.debug(f"[SkillLoader] Loaded skill: {metadata.name}")
                        except Exception as e:
                            logger.error(f"[SkillLoader] Failed to parse {skill_md}: {e}")

        logger.info(f"[SkillLoader] Loaded {len(self._registry)} skills from filesystem")
        return self._registry

    async def scan_skills_with_database(self) -> Dict[str, SkillMetadata]:
        """Scan skills from filesystem and database.

        Returns:
            Dict mapping skill name to SkillMetadata
        """
        # First scan filesystem
        self.scan_skills()

        # Then load from database (overrides filesystem if same name)
        if self._database:
            try:
                user_skills = await self._database.get_all_user_skills()
                for skill in user_skills:
                    allowed_tools = []
                    if skill.allowed_tools:
                        allowed_tools = [t.strip() for t in skill.allowed_tools.split(',')]

                    metadata_dict = {}
                    if skill.metadata_json:
                        import json
                        metadata_dict = json.loads(skill.metadata_json)

                    self._registry[skill.name] = SkillMetadata(
                        name=skill.name,
                        description=skill.description,
                        allowed_tools=allowed_tools,
                        metadata=metadata_dict,
                        path=None  # Database skills have no path
                    )
                logger.info(f"[SkillLoader] Loaded {len(user_skills)} skills from database")
            except Exception as e:
                logger.error(f"[SkillLoader] Failed to load skills from database: {e}")

        return self._registry

    def _parse_skill_metadata(self, skill_md_path: Path) -> Optional[SkillMetadata]:
        """Parse SKILL.md frontmatter to extract metadata.

        Args:
            skill_md_path: Path to SKILL.md file

        Returns:
            SkillMetadata or None if parsing fails
        """
        content = skill_md_path.read_text(encoding='utf-8')

        # Parse YAML frontmatter (between --- markers)
        frontmatter_match = re.match(r'^---\s*\n(.*?)\n---\s*\n', content, re.DOTALL)
        if not frontmatter_match:
            logger.warning(f"[SkillLoader] No frontmatter in {skill_md_path}")
            return None

        try:
            frontmatter = yaml.safe_load(frontmatter_match.group(1))
        except yaml.YAMLError as e:
            logger.error(f"[SkillLoader] Invalid YAML in {skill_md_path}: {e}")
            return None

        # Validate required fields
        name = frontmatter.get('name')
        description = frontmatter.get('description')

        if not name or not description:
            logger.warning(f"[SkillLoader] Missing name or description in {skill_md_path}")
            return None

        # Validate name format (lowercase, hyphens, no consecutive hyphens)
        if not re.match(r'^[a-z0-9]+(-[a-z0-9]+)*$', name):
            logger.warning(f"[SkillLoader] Invalid skill name format: {name}")
            return None

        # Parse allowed-tools (space-delimited)
        allowed_tools = []
        if 'allowed-tools' in frontmatter:
            allowed_tools = frontmatter['allowed-tools'].split()

        return SkillMetadata(
            name=name,
            description=description,
            allowed_tools=allowed_tools,
            metadata=frontmatter.get('metadata', {})
        )

    def load_skill(self, name: str) -> Optional[Skill]:
        """Load full skill content by name.

        Args:
            name: Skill name to load

        Returns:
            Skill with full content or None if not found
        """
        # Check cache first
        if name in self._cache:
            return self._cache[name]

        # Check registry
        if name not in self._registry:
            logger.warning(f"[SkillLoader] Skill not found: {name}")
            return None

        metadata = self._registry[name]

        # Database skills have no path - load from database
        if metadata.path is None:
            return self._load_skill_from_database(name, metadata)

        # Filesystem skills
        skill_path = metadata.path
        skill_md = skill_path / "SKILL.md"

        if not skill_md.exists():
            logger.error(f"[SkillLoader] SKILL.md not found for {name}")
            return None

        # Parse full content
        content = skill_md.read_text(encoding='utf-8')

        # Extract body (after frontmatter)
        frontmatter_match = re.match(r'^---\s*\n.*?\n---\s*\n', content, re.DOTALL)
        if frontmatter_match:
            instructions = content[frontmatter_match.end():]
        else:
            instructions = content

        # Load scripts directory
        scripts = {}
        scripts_dir = skill_path / "scripts"
        if scripts_dir.exists():
            for script_file in scripts_dir.iterdir():
                if script_file.is_file():
                    try:
                        scripts[script_file.name] = script_file.read_text(encoding='utf-8')
                    except Exception as e:
                        logger.warning(f"[SkillLoader] Failed to read script {script_file}: {e}")

        # Load references directory
        references = {}
        refs_dir = skill_path / "references"
        if refs_dir.exists():
            for ref_file in refs_dir.iterdir():
                if ref_file.is_file() and ref_file.suffix in ['.md', '.txt', '.json']:
                    try:
                        references[ref_file.name] = ref_file.read_text(encoding='utf-8')
                    except Exception as e:
                        logger.warning(f"[SkillLoader] Failed to read reference {ref_file}: {e}")

        skill = Skill(
            metadata=metadata,
            instructions=instructions,
            scripts=scripts,
            references=references
        )

        # Cache the loaded skill
        self._cache[name] = skill
        logger.debug(f"[SkillLoader] Loaded full skill: {name} ({len(instructions)} chars)")

        return skill

    def _load_skill_from_database(self, name: str, metadata: SkillMetadata) -> Optional[Skill]:
        """Load skill from database (synchronous wrapper for cached data)."""
        # This should be called after scan_skills_with_database
        # The full instructions should be loaded via async method
        logger.warning(f"[SkillLoader] Database skill {name} requires async loading")
        return None

    async def load_skill_async(self, name: str) -> Optional[Skill]:
        """Async version of load_skill for database skills.

        Args:
            name: Skill name to load

        Returns:
            Skill with full content or None if not found
        """
        # Check cache first
        if name in self._cache:
            return self._cache[name]

        # Try filesystem first
        if name in self._registry and self._registry[name].path is not None:
            return self.load_skill(name)

        # Load from database
        if self._database:
            try:
                user_skill = await self._database.get_user_skill_by_name(name)
                if user_skill:
                    allowed_tools = []
                    if user_skill.allowed_tools:
                        allowed_tools = [t.strip() for t in user_skill.allowed_tools.split(',')]

                    metadata_dict = {}
                    if user_skill.metadata_json:
                        import json
                        metadata_dict = json.loads(user_skill.metadata_json)

                    metadata = SkillMetadata(
                        name=user_skill.name,
                        description=user_skill.description,
                        allowed_tools=allowed_tools,
                        metadata=metadata_dict,
                        path=None
                    )

                    skill = Skill(
                        metadata=metadata,
                        instructions=user_skill.instructions,
                        scripts={},
                        references={}
                    )

                    self._cache[name] = skill
                    return skill
            except Exception as e:
                logger.error(f"[SkillLoader] Failed to load skill {name} from database: {e}")

        return None

    def get_registry_prompt(self, skill_names: List[str] = None) -> str:
        """Generate skill registry for LLM system prompt.

        Args:
            skill_names: Optional list of skill names to include.
                        If None, includes all registered skills.

        Returns:
            Formatted string listing available skills
        """
        skills_to_include = skill_names or list(self._registry.keys())

        if not skills_to_include:
            return ""

        lines = ["## Available Skills", ""]
        lines.append("You have access to the following skills. When a user's request matches a skill's purpose, activate it to help them.")
        lines.append("")

        for name in skills_to_include:
            if name in self._registry:
                metadata = self._registry[name]
                lines.append(f"- **{name}**: {metadata.description}")
                if metadata.allowed_tools:
                    tools_str = ", ".join(metadata.allowed_tools)
                    lines.append(f"  - Tools: {tools_str}")

        lines.append("")
        lines.append("To use a skill, identify when the user's request matches its purpose and apply the skill's instructions.")

        return "\n".join(lines)

    def get_skill_instructions(self, name: str) -> Optional[str]:
        """Get full instructions for a skill (loads if not cached).

        Args:
            name: Skill name

        Returns:
            Markdown instructions or None if not found
        """
        skill = self.load_skill(name)
        return skill.instructions if skill else None

    def get_available_skills(self) -> List[Dict[str, Any]]:
        """Get list of available skills for frontend display.

        Returns:
            List of skill info dicts
        """
        return [
            {
                "name": metadata.name,
                "description": metadata.description,
                "allowed_tools": metadata.allowed_tools,
                "metadata": metadata.metadata,
                "is_builtin": metadata.path is not None
            }
            for metadata in self._registry.values()
        ]

    def clear_cache(self):
        """Clear the skill cache."""
        self._cache.clear()
        logger.debug("[SkillLoader] Cache cleared")


# Global skill loader instance
_skill_loader: Optional[SkillLoader] = None


def get_skill_loader() -> SkillLoader:
    """Get the global skill loader instance."""
    global _skill_loader
    if _skill_loader is None:
        # Default directories
        server_dir = Path(__file__).parent.parent
        skill_dirs = [
            server_dir / "skills",  # Built-in skills
            Path.cwd() / ".machina" / "skills",  # Project skills
        ]
        _skill_loader = SkillLoader(skill_dirs=skill_dirs)
        _skill_loader.scan_skills()
    return _skill_loader


def init_skill_loader(database=None) -> SkillLoader:
    """Initialize the global skill loader with database support.

    Args:
        database: Database instance for user skill storage

    Returns:
        Initialized SkillLoader
    """
    global _skill_loader
    server_dir = Path(__file__).parent.parent
    skill_dirs = [
        server_dir / "skills",  # Built-in skills
        Path.cwd() / ".machina" / "skills",  # Project skills
    ]
    _skill_loader = SkillLoader(skill_dirs=skill_dirs, database=database)
    _skill_loader.scan_skills()
    return _skill_loader
