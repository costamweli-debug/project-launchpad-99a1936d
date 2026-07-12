GRANT SELECT ON public.curriculum_subjects TO authenticated;
GRANT SELECT ON public.curriculum_topics TO authenticated;
GRANT SELECT ON public.curriculum_subtopics TO authenticated;
GRANT ALL ON public.curriculum_subjects TO service_role;
GRANT ALL ON public.curriculum_topics TO service_role;
GRANT ALL ON public.curriculum_subtopics TO service_role;