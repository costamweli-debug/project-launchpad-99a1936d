GRANT SELECT ON TABLE public.curriculum_subjects TO authenticated;
GRANT SELECT ON TABLE public.curriculum_topics TO authenticated;
GRANT SELECT ON TABLE public.curriculum_subtopics TO authenticated;

GRANT ALL ON TABLE public.curriculum_subjects TO service_role;
GRANT ALL ON TABLE public.curriculum_topics TO service_role;
GRANT ALL ON TABLE public.curriculum_subtopics TO service_role;