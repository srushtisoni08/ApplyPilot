from pydantic import BaseModel


class Education(BaseModel):
    institution: str | None = None
    degree: str | None = None
    field: str | None = None
    start_year: int | None = None
    end_year: int | None = None
    cgpa: float | None = None


class Project(BaseModel):
    name: str | None = None
    description: str | None = None
    tech: list[str] = []


class Experience(BaseModel):
    company: str | None = None
    role: str | None = None
    duration: str | None = None
    description: str | None = None


class CandidateProfileSchema(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    cgpa: float | None = None
    grad_year: int | None = None
    education: list[Education] = []
    skills: list[str] = []
    projects: list[Project] = []
    experience: list[Experience] = []
    certificates: list[str] = []
    low_confidence_fields: list[str] = []  # fields you were unsure about


class OpportunityData(BaseModel):
    company: str | None = None
    role: str | None = None
    required_skills: list[str] = []
    min_cgpa: float | None = None
    graduation_year: list[int] | None = None
    experience_years: float | None = None
    location: str | None = None
    compensation: str | None = None
    apply_link: str | None = None
    deadline: str | None = None  # YYYY-MM-DD
    low_confidence_fields: list[str] = []


class EmailCheck(BaseModel):
    is_opportunity: bool
    reason: str